from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from math import sqrt
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance


ROOT = Path(__file__).resolve().parents[1]

FRAME_SIZE = 256
FRAME_COUNT = 4
GROUND_Y = 255
ALPHA_BBOX_THRESHOLD = 16
RAW_SCALE_BBOX_THRESHOLD = 96
KEY_CLEAR_DISTANCE = 24
KEY_KEEP_DISTANCE = 128
KEY_SPILL_KEEP_DISTANCE = 340


@dataclass(frozen=True)
class FrameSpec:
    scale_x: float = 1
    scale_y: float = 1
    rotate: float = 0
    x: int = 0
    y: int = 0
    opacity: float = 1
    tint: tuple[int, int, int] | None = None
    tint_amount: float = 0
    brightness: float = 1
    contrast: float = 1


@dataclass(frozen=True)
class EnemyBuildSpec:
    enemy_id: str
    target_height: int
    max_width: int
    death_style: str
    scale_x_boost: float = 1
    scale_y_boost: float = 1
    palette: str | None = None


ENEMIES = [
    EnemyBuildSpec("tank", target_height=252, max_width=250, death_style="heavy"),
    EnemyBuildSpec("flyer", target_height=216, max_width=250, death_style="flyer"),
    EnemyBuildSpec("runner", target_height=120, max_width=248, death_style="low", scale_x_boost=0.9),
    EnemyBuildSpec("insulated", target_height=252, max_width=224, death_style="heavy", palette="brown-mud"),
    EnemyBuildSpec("flameproof", target_height=117, max_width=230, death_style="low", scale_y_boost=1.2),
]


def main() -> None:
    previews: list[tuple[str, Image.Image]] = []

    for spec in ENEMIES:
        move_sheet, seed = render_enemy(spec)
        previews.append((spec.enemy_id, move_sheet))
        render_preview(spec.enemy_id).save(ROOT / f"output/sprites/{spec.enemy_id}-redraw-preview.png")

    render_move_contact_sheet(previews).save(ROOT / "output/sprites/remaining-enemies-redraw-move-preview.png")


def render_enemy(spec: EnemyBuildSpec) -> tuple[Image.Image, Image.Image]:
    out_dir = ROOT / f"public/assets/enemies/{spec.enemy_id}/redraw"
    hud_out = ROOT / f"public/assets/enemies/hud/{spec.enemy_id}-preview-redraw.png"
    move_raw_source = ROOT / f"asset-sources/public-assets/enemies/{spec.enemy_id}/redraw/source/{spec.enemy_id}-move-redraw-raw-01.png"

    out_dir.mkdir(parents=True, exist_ok=True)
    hud_out.parent.mkdir(parents=True, exist_ok=True)
    (ROOT / "output/sprites").mkdir(parents=True, exist_ok=True)

    move_sheet, seed_subject = render_raw_move_sheet(spec, move_raw_source)
    seed = move_sheet.crop((0, 0, FRAME_SIZE, FRAME_SIZE))
    hit_sheet = render_sheet(seed_subject, hit_specs())
    death_sheet = render_sheet(seed_subject, death_specs(spec.death_style))

    seed.save(out_dir / f"{spec.enemy_id}-seed-side-redraw.png")
    move_sheet.save(out_dir / f"{spec.enemy_id}-move-side-redraw.png")
    hit_sheet.save(out_dir / f"{spec.enemy_id}-hit-side-redraw.png")
    death_sheet.save(out_dir / f"{spec.enemy_id}-death-side-redraw.png")
    render_hud_preview(seed).save(hud_out)

    return move_sheet, seed


def render_raw_move_sheet(spec: EnemyBuildSpec, source: Path) -> tuple[Image.Image, Image.Image]:
    if not source.exists():
        raise FileNotFoundError(source)

    raw = remove_chroma_key(Image.open(source).convert("RGBA"))
    slots = []
    for index in range(FRAME_COUNT):
        slot = crop_to_alpha(
            raw.crop((
                round(raw.width * index / FRAME_COUNT),
                0,
                round(raw.width * (index + 1) / FRAME_COUNT),
                raw.height,
            )),
            padding=8,
            threshold=RAW_SCALE_BBOX_THRESHOLD,
        )
        slots.append(keep_largest_alpha_component(slot, padding=6))
    scale = get_shared_scale(slots, spec)
    sheet = Image.new("RGBA", (FRAME_SIZE * FRAME_COUNT, FRAME_SIZE), (0, 0, 0, 0))
    seed_subject: Image.Image | None = None

    for index, slot in enumerate(slots):
        sprite = apply_palette(resize_subject(slot, scale, spec.scale_x_boost, spec.scale_y_boost), spec)
        frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
        x = (FRAME_SIZE - sprite.width) // 2
        y = GROUND_Y - sprite.height

        alpha_composite_clipped(frame, sprite, (x, y))
        sheet.alpha_composite(frame, (FRAME_SIZE * index, 0))

        if index == 0:
            seed_subject = sprite

    if seed_subject is None:
        raise ValueError(f"No seed subject rendered for {spec.enemy_id}.")

    return sheet, seed_subject


def hit_specs() -> list[FrameSpec]:
    return [
        FrameSpec(scale_x=0.94, scale_y=1.08, rotate=-2, x=-7, y=-5, tint=(255, 229, 184), tint_amount=0.34, brightness=1.16),
        FrameSpec(scale_x=1.04, scale_y=0.96, x=6, y=3, tint=(221, 76, 46), tint_amount=0.22, contrast=1.08),
        FrameSpec(scale_x=1.02, scale_y=1.01, x=0, y=-1, tint=(255, 207, 130), tint_amount=0.12),
        FrameSpec(),
    ]


def death_specs(style: str) -> list[FrameSpec]:
    if style == "flyer":
        return [
            FrameSpec(),
            FrameSpec(scale_x=1.02, scale_y=0.90, rotate=-16, x=-6, y=20, tint=(99, 72, 80), tint_amount=0.18, brightness=0.84),
            FrameSpec(scale_x=1.00, scale_y=0.62, rotate=-46, x=-15, y=53, tint=(65, 53, 58), tint_amount=0.32, brightness=0.66),
            FrameSpec(scale_x=1.08, scale_y=0.38, rotate=-70, x=-22, y=74, opacity=0.72, tint=(46, 40, 44), tint_amount=0.44, brightness=0.52),
        ]

    if style == "low":
        return [
            FrameSpec(),
            FrameSpec(scale_x=1.02, scale_y=0.78, rotate=-4, x=-3, y=18, tint=(119, 79, 46), tint_amount=0.16, brightness=0.86),
            FrameSpec(scale_x=1.10, scale_y=0.52, rotate=-8, x=-6, y=45, tint=(74, 55, 40), tint_amount=0.30, brightness=0.68),
            FrameSpec(scale_x=1.16, scale_y=0.34, rotate=-10, x=-8, y=66, opacity=0.74, tint=(55, 45, 36), tint_amount=0.44, brightness=0.54),
        ]

    return [
        FrameSpec(),
        FrameSpec(scale_x=1.00, scale_y=0.92, rotate=-8, x=-5, y=16, tint=(119, 79, 46), tint_amount=0.16, brightness=0.86),
        FrameSpec(scale_x=1.04, scale_y=0.64, rotate=-18, x=-10, y=44, tint=(74, 55, 40), tint_amount=0.30, brightness=0.68),
        FrameSpec(scale_x=1.10, scale_y=0.42, rotate=-26, x=-14, y=66, opacity=0.74, tint=(55, 45, 36), tint_amount=0.44, brightness=0.54),
    ]


def remove_chroma_key(image: Image.Image) -> Image.Image:
    key = sample_border_key(image)
    output = Image.new("RGBA", image.size)
    pixels = []

    pixel_source = getattr(image, "get_flattened_data", image.getdata)
    for red, green, blue, alpha in pixel_source():
        distance = color_distance((red, green, blue), key)
        if alpha == 0 or distance <= KEY_CLEAR_DISTANCE:
            pixels.append((0, 0, 0, 0))
            continue

        keep_distance = KEY_SPILL_KEEP_DISTANCE if is_key_spill((red, green, blue), key) else KEY_KEEP_DISTANCE
        if distance < keep_distance:
            normalized_alpha = (distance - KEY_CLEAR_DISTANCE) / (keep_distance - KEY_CLEAR_DISTANCE)
            new_alpha = int(alpha * normalized_alpha)
            red, green, blue = unmix_key((red, green, blue), key, normalized_alpha)
        else:
            new_alpha = alpha

        pixels.append((red, green, blue, max(0, min(255, new_alpha))))

    output.putdata(pixels)
    return output


def sample_border_key(image: Image.Image) -> tuple[int, int, int]:
    width, height = image.size
    samples: list[tuple[int, int, int]] = []

    for x in range(0, width, 4):
        samples.append(image.getpixel((x, 0))[:3])
        samples.append(image.getpixel((x, height - 1))[:3])
    for y in range(0, height, 4):
        samples.append(image.getpixel((0, y))[:3])
        samples.append(image.getpixel((width - 1, y))[:3])

    return Counter(samples).most_common(1)[0][0]


def color_distance(color: tuple[int, int, int], key: tuple[int, int, int]) -> float:
    return sqrt(sum((channel - key_channel) ** 2 for channel, key_channel in zip(color, key)))


def is_key_spill(color: tuple[int, int, int], key: tuple[int, int, int]) -> bool:
    if key[0] > key[1] + 24 and key[2] > key[1] + 24:
        return color[0] > color[1] + 24 and color[2] > color[1] + 24 and abs(color[0] - color[2]) < 96

    dominant_channel = max(range(3), key=lambda index: key[index])
    other_channels = [index for index in range(3) if index != dominant_channel]

    return all(color[dominant_channel] > color[index] + 24 for index in other_channels)


def unmix_key(color: tuple[int, int, int], key: tuple[int, int, int], alpha: float) -> tuple[int, int, int]:
    alpha = max(alpha, 0.08)
    return tuple(
        max(0, min(255, int((channel - key_channel * (1 - alpha)) / alpha)))
        for channel, key_channel in zip(color, key)
    )


def crop_to_alpha(image: Image.Image, padding: int, threshold: int = ALPHA_BBOX_THRESHOLD) -> Image.Image:
    bbox = alpha_bbox(image, threshold)
    if bbox is None:
        raise ValueError("No non-transparent sprite pixels found.")

    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width, right + padding)
    bottom = min(image.height, bottom + padding)
    return image.crop((left, top, right, bottom))


def alpha_bbox(image: Image.Image, threshold: int = ALPHA_BBOX_THRESHOLD) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(lambda value: 255 if value > threshold else 0).getbbox()


def keep_largest_alpha_component(image: Image.Image, padding: int) -> Image.Image:
    alpha = image.getchannel("A")
    width, height = image.size
    visited = bytearray(width * height)
    best: tuple[int, int, int, int, int] | None = None

    for y in range(height):
        for x in range(width):
            offset = y * width + x
            if visited[offset] or alpha.getpixel((x, y)) <= RAW_SCALE_BBOX_THRESHOLD:
                continue

            count, bbox = flood_alpha_component(alpha, visited, x, y)
            if best is None or count > best[0]:
                best = (count, *bbox)

    if best is None:
        return image

    _, left, top, right, bottom = best
    return image.crop((
        max(0, left - padding),
        max(0, top - padding),
        min(width, right + padding),
        min(height, bottom + padding),
    ))


def flood_alpha_component(
    alpha: Image.Image,
    visited: bytearray,
    start_x: int,
    start_y: int,
) -> tuple[int, tuple[int, int, int, int]]:
    width, height = alpha.size
    stack = [(start_x, start_y)]
    count = 0
    left = right = start_x
    top = bottom = start_y

    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= width or y >= height:
            continue

        offset = y * width + x
        if visited[offset] or alpha.getpixel((x, y)) <= RAW_SCALE_BBOX_THRESHOLD:
            continue

        visited[offset] = 1
        count += 1
        left = min(left, x)
        top = min(top, y)
        right = max(right, x + 1)
        bottom = max(bottom, y + 1)

        stack.append((x + 1, y))
        stack.append((x - 1, y))
        stack.append((x, y + 1))
        stack.append((x, y - 1))

    return count, (left, top, right, bottom)


def get_shared_scale(subjects: list[Image.Image], spec: EnemyBuildSpec) -> float:
    max_width = 1
    max_height = 1

    for subject in subjects:
        bbox = alpha_bbox(subject, RAW_SCALE_BBOX_THRESHOLD)
        if bbox is None:
            continue

        max_width = max(max_width, bbox[2] - bbox[0])
        max_height = max(max_height, bbox[3] - bbox[1])

    return min(spec.max_width / max_width, spec.target_height / max_height)


def resize_subject(subject: Image.Image, scale: float, scale_x_boost: float = 1, scale_y_boost: float = 1) -> Image.Image:
    size = (round(subject.width * scale * scale_x_boost), round(subject.height * scale * scale_y_boost))
    fitted = subject.resize(size, Image.Resampling.LANCZOS)
    return crop_to_alpha(fitted, padding=1)


def apply_palette(image: Image.Image, spec: EnemyBuildSpec) -> Image.Image:
    if spec.palette != "brown-mud":
        return image

    output = image.copy().convert("RGBA")
    pixels = []

    pixel_source = getattr(output, "get_flattened_data", output.getdata)
    for red, green, blue, alpha in pixel_source():
        if alpha > 0 and green > red + 8 and green > blue + 8:
            luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
            red = int(max(0, min(255, luminance * 0.96 + 38)))
            green = int(max(0, min(255, luminance * 0.58 + 30)))
            blue = int(max(0, min(255, luminance * 0.30 + 18)))

        pixels.append((red, green, blue, alpha))

    output.putdata(pixels)
    return output


def render_sheet(subject: Image.Image, specs: list[FrameSpec]) -> Image.Image:
    if len(specs) != FRAME_COUNT:
        raise ValueError(f"Expected {FRAME_COUNT} frames, got {len(specs)}.")

    sheet = Image.new("RGBA", (FRAME_SIZE * FRAME_COUNT, FRAME_SIZE), (0, 0, 0, 0))
    for index, spec in enumerate(specs):
        sheet.alpha_composite(compose_frame(subject, spec), (FRAME_SIZE * index, 0))
    return sheet


def compose_frame(subject: Image.Image, spec: FrameSpec) -> Image.Image:
    sprite = transform_subject(subject, spec)
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    x = (FRAME_SIZE - sprite.width) // 2 + spec.x
    y = GROUND_Y - sprite.height + spec.y
    alpha_composite_clipped(frame, sprite, (x, y))
    return frame


def transform_subject(subject: Image.Image, spec: FrameSpec) -> Image.Image:
    width = max(1, round(subject.width * spec.scale_x))
    height = max(1, round(subject.height * spec.scale_y))
    sprite = subject.resize((width, height), Image.Resampling.LANCZOS)

    if spec.rotate:
        sprite = sprite.rotate(spec.rotate, resample=Image.Resampling.BICUBIC, expand=True)

    sprite = crop_to_alpha(sprite, padding=1)

    if spec.tint is not None and spec.tint_amount > 0:
        sprite = tint(sprite, spec.tint, spec.tint_amount)
    if spec.brightness != 1:
        sprite = with_alpha(ImageEnhance.Brightness(sprite.convert("RGB")).enhance(spec.brightness), sprite.getchannel("A"))
    if spec.contrast != 1:
        sprite = with_alpha(ImageEnhance.Contrast(sprite.convert("RGB")).enhance(spec.contrast), sprite.getchannel("A"))
    if spec.opacity < 1:
        alpha = sprite.getchannel("A").point(lambda value: int(value * spec.opacity))
        sprite.putalpha(alpha)

    return sprite


def tint(image: Image.Image, color: tuple[int, int, int], amount: float) -> Image.Image:
    alpha = image.getchannel("A")
    overlay = Image.new("RGB", image.size, color)
    tinted = Image.blend(image.convert("RGB"), overlay, amount)
    return with_alpha(tinted, alpha)


def with_alpha(rgb: Image.Image, alpha: Image.Image) -> Image.Image:
    output = rgb.convert("RGBA")
    output.putalpha(alpha)
    return output


def alpha_composite_clipped(frame: Image.Image, sprite: Image.Image, position: tuple[int, int]) -> None:
    x, y = position
    left = max(0, x)
    top = max(0, y)
    right = min(frame.width, x + sprite.width)
    bottom = min(frame.height, y + sprite.height)

    if left >= right or top >= bottom:
        return

    crop = sprite.crop((left - x, top - y, right - x, bottom - y))
    frame.alpha_composite(crop, (left, top))


def render_hud_preview(seed: Image.Image) -> Image.Image:
    cropped = crop_to_alpha(seed, padding=6)
    scale = min(48 / cropped.width, 48 / cropped.height)
    size = (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale)))
    sprite = cropped.resize(size, Image.Resampling.LANCZOS)
    preview = Image.new("RGBA", (50, 50), (0, 0, 0, 0))
    preview.alpha_composite(sprite, ((50 - sprite.width) // 2, (50 - sprite.height) // 2))
    return preview


def render_preview(enemy_id: str) -> Image.Image:
    sheets = [
        Image.open(ROOT / f"public/assets/enemies/{enemy_id}/redraw/{enemy_id}-move-side-redraw.png").convert("RGBA"),
        Image.open(ROOT / f"public/assets/enemies/{enemy_id}/redraw/{enemy_id}-hit-side-redraw.png").convert("RGBA"),
        Image.open(ROOT / f"public/assets/enemies/{enemy_id}/redraw/{enemy_id}-death-side-redraw.png").convert("RGBA"),
    ]
    scale = 0.5
    padding = 12
    label_width = 100
    row_height = round(FRAME_SIZE * scale)
    width = label_width + round(FRAME_SIZE * FRAME_COUNT * scale) + padding * 2
    height = row_height * len(sheets) + padding * (len(sheets) + 1)
    preview = Image.new("RGBA", (width, height), (19, 18, 16, 255))
    draw = ImageDraw.Draw(preview)

    for index, sheet in enumerate(sheets):
        row = sheet.resize((round(sheet.width * scale), row_height), Image.Resampling.LANCZOS)
        y = padding + index * (row_height + padding)
        draw.text((padding, y + 8), ["move", "hit", "death"][index], fill=(221, 204, 158, 255))
        preview.alpha_composite(row, (label_width, y))
        draw.line((label_width, y + row_height - 1, width - padding, y + row_height - 1), fill=(94, 76, 50, 180))

    return preview


def render_move_contact_sheet(items: list[tuple[str, Image.Image]]) -> Image.Image:
    scale = 0.5
    padding = 12
    label_width = 112
    row_height = round(FRAME_SIZE * scale)
    width = label_width + round(FRAME_SIZE * FRAME_COUNT * scale) + padding * 2
    height = row_height * len(items) + padding * (len(items) + 1)
    preview = Image.new("RGBA", (width, height), (19, 18, 16, 255))
    draw = ImageDraw.Draw(preview)

    for index, (enemy_id, sheet) in enumerate(items):
        row = sheet.resize((round(sheet.width * scale), row_height), Image.Resampling.LANCZOS)
        y = padding + index * (row_height + padding)
        draw.text((padding, y + 8), enemy_id, fill=(221, 204, 158, 255))
        preview.alpha_composite(row, (label_width, y))
        draw.line((label_width, y + row_height - 1, width - padding, y + row_height - 1), fill=(94, 76, 50, 180))

    return preview


if __name__ == "__main__":
    main()
