from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from math import sqrt
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "asset-sources/public-assets/enemies/swarm/redraw/source/swarm-redraw-source-01.png"
MOVE_RAW_SOURCE = ROOT / "asset-sources/public-assets/enemies/swarm/redraw/source/swarm-move-redraw-raw-01.png"
OUT_DIR = ROOT / "public/assets/enemies/swarm/redraw"
HUD_OUT = ROOT / "public/assets/enemies/hud/swarm-preview-redraw.png"
PREVIEW_OUT = ROOT / "output/sprites/swarm-redraw-preview.png"

FRAME_SIZE = 256
FRAME_COUNT = 4
TARGET_HEIGHT = 126
MAX_WIDTH = 238
GROUND_Y = 255
ALPHA_BBOX_THRESHOLD = 16
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


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    HUD_OUT.parent.mkdir(parents=True, exist_ok=True)
    PREVIEW_OUT.parent.mkdir(parents=True, exist_ok=True)

    source = Image.open(SOURCE).convert("RGBA")
    cutout = crop_to_alpha(remove_chroma_key(source), padding=8)
    subject = fit_subject(cutout)

    seed = compose_frame(subject, FrameSpec())
    seed.save(OUT_DIR / "swarm-seed-side-redraw.png")

    sheets = {
        "hit": [
            FrameSpec(scale_x=0.94, scale_y=1.08, rotate=-2, x=-7, y=-5, tint=(255, 229, 184), tint_amount=0.34, brightness=1.16),
            FrameSpec(scale_x=1.04, scale_y=0.96, x=6, y=3, tint=(221, 76, 46), tint_amount=0.22, contrast=1.08),
            FrameSpec(scale_x=1.02, scale_y=1.01, x=0, y=-1, tint=(255, 207, 130), tint_amount=0.12),
            FrameSpec(),
        ],
        "death": [
            FrameSpec(),
            FrameSpec(scale_x=1.04, scale_y=0.86, rotate=-6, x=-4, y=17, tint=(119, 79, 46), tint_amount=0.18, brightness=0.86),
            FrameSpec(scale_x=1.10, scale_y=0.58, rotate=-11, x=-7, y=45, tint=(74, 55, 40), tint_amount=0.32, brightness=0.68),
            FrameSpec(scale_x=1.12, scale_y=0.38, rotate=-13, x=-8, y=65, opacity=0.74, tint=(55, 45, 36), tint_amount=0.44, brightness=0.54),
        ],
    }

    rendered_sheets: list[Image.Image] = []
    move_sheet = render_move_sheet(subject)
    move_sheet.save(OUT_DIR / "swarm-move-side-redraw.png")
    rendered_sheets.append(move_sheet)

    for animation_name, specs in sheets.items():
        sheet = render_sheet(subject, specs)
        sheet.save(OUT_DIR / f"swarm-{animation_name}-side-redraw.png")
        rendered_sheets.append(sheet)

    render_hud_preview(seed).save(HUD_OUT)
    render_preview(rendered_sheets).save(PREVIEW_OUT)


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
    dominant_channel = max(range(3), key=lambda index: key[index])
    other_channels = [index for index in range(3) if index != dominant_channel]

    return all(color[dominant_channel] > color[index] + 24 for index in other_channels)


def unmix_key(color: tuple[int, int, int], key: tuple[int, int, int], alpha: float) -> tuple[int, int, int]:
    alpha = max(alpha, 0.08)
    return tuple(
        max(0, min(255, int((channel - key_channel * (1 - alpha)) / alpha)))
        for channel, key_channel in zip(color, key)
    )


def crop_to_alpha(image: Image.Image, padding: int) -> Image.Image:
    bbox = alpha_bbox(image)
    if bbox is None:
        raise ValueError("No non-transparent sprite pixels found.")

    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width, right + padding)
    bottom = min(image.height, bottom + padding)
    return image.crop((left, top, right, bottom))


def fit_subject(subject: Image.Image) -> Image.Image:
    bbox = alpha_bbox(subject)
    if bbox is None:
        raise ValueError("No subject pixels found.")

    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    scale = min(MAX_WIDTH / width, TARGET_HEIGHT / height)
    size = (round(subject.width * scale), round(subject.height * scale))
    fitted = subject.resize(size, Image.Resampling.LANCZOS)
    return crop_to_alpha(fitted, padding=2)


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(lambda value: 255 if value > ALPHA_BBOX_THRESHOLD else 0).getbbox()


def render_sheet(subject: Image.Image, specs: list[FrameSpec]) -> Image.Image:
    if len(specs) != FRAME_COUNT:
        raise ValueError(f"Expected {FRAME_COUNT} frames, got {len(specs)}.")

    sheet = Image.new("RGBA", (FRAME_SIZE * FRAME_COUNT, FRAME_SIZE), (0, 0, 0, 0))
    for index, spec in enumerate(specs):
        sheet.alpha_composite(compose_frame(subject, spec), (FRAME_SIZE * index, 0))
    return sheet


def render_move_sheet(subject: Image.Image) -> Image.Image:
    if MOVE_RAW_SOURCE.exists():
        return render_raw_move_sheet()

    return render_sheet(subject, [
        FrameSpec(),
        FrameSpec(scale_x=0.97, scale_y=1.06, x=4, y=-3),
        FrameSpec(scale_x=1.04, scale_y=0.94, x=-3, y=2),
        FrameSpec(scale_x=1.01, scale_y=1.02, x=2, y=-1),
    ])


def render_raw_move_sheet() -> Image.Image:
    raw = remove_chroma_key(Image.open(MOVE_RAW_SOURCE).convert("RGBA"))
    slot_width = raw.width // FRAME_COUNT
    slots = [
        crop_to_alpha(raw.crop((slot_width * index, 0, slot_width * (index + 1), raw.height)), padding=8)
        for index in range(FRAME_COUNT)
    ]
    scale = get_shared_scale(slots)
    sheet = Image.new("RGBA", (FRAME_SIZE * FRAME_COUNT, FRAME_SIZE), (0, 0, 0, 0))

    for index, slot in enumerate(slots):
        sprite = resize_subject(slot, scale)
        frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
        x = (FRAME_SIZE - sprite.width) // 2
        y = GROUND_Y - sprite.height

        frame.alpha_composite(sprite, (x, y))
        sheet.alpha_composite(frame, (FRAME_SIZE * index, 0))

    return sheet


def get_shared_scale(subjects: list[Image.Image]) -> float:
    max_width = 1
    max_height = 1

    for subject in subjects:
        bbox = alpha_bbox(subject)
        if bbox is None:
            continue

        max_width = max(max_width, bbox[2] - bbox[0])
        max_height = max(max_height, bbox[3] - bbox[1])

    return min(MAX_WIDTH / max_width, TARGET_HEIGHT / max_height)


def resize_subject(subject: Image.Image, scale: float) -> Image.Image:
    size = (round(subject.width * scale), round(subject.height * scale))
    fitted = subject.resize(size, Image.Resampling.LANCZOS)
    return crop_to_alpha(fitted, padding=1)


def compose_frame(subject: Image.Image, spec: FrameSpec) -> Image.Image:
    sprite = transform_subject(subject, spec)
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    x = (FRAME_SIZE - sprite.width) // 2 + spec.x
    y = GROUND_Y - sprite.height + spec.y
    frame.alpha_composite(sprite, (x, y))
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


def render_hud_preview(seed: Image.Image) -> Image.Image:
    cropped = crop_to_alpha(seed, padding=6)
    scale = min(48 / cropped.width, 48 / cropped.height)
    size = (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale)))
    sprite = cropped.resize(size, Image.Resampling.LANCZOS)
    preview = Image.new("RGBA", (50, 50), (0, 0, 0, 0))
    preview.alpha_composite(sprite, ((50 - sprite.width) // 2, (50 - sprite.height) // 2))
    return preview


def render_preview(sheets: list[Image.Image]) -> Image.Image:
    scale = 0.5
    padding = 12
    row_height = round(FRAME_SIZE * scale)
    width = round(FRAME_SIZE * FRAME_COUNT * scale) + padding * 2
    height = row_height * len(sheets) + padding * (len(sheets) + 1)
    preview = Image.new("RGBA", (width, height), (19, 18, 16, 255))
    draw = ImageDraw.Draw(preview)

    for index, sheet in enumerate(sheets):
        row = sheet.resize((round(sheet.width * scale), row_height), Image.Resampling.LANCZOS)
        y = padding + index * (row_height + padding)
        preview.alpha_composite(row, (padding, y))
        draw.line((padding, y + row_height - 1, width - padding, y + row_height - 1), fill=(94, 76, 50, 180))

    return preview


if __name__ == "__main__":
    main()
