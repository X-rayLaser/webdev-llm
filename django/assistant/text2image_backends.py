import hashlib
import random
from PIL import Image, ImageDraw
from io import BytesIO
from abc import ABC, abstractmethod


class Backend(ABC):
    @abstractmethod
    def generate_image(self, text):
        pass


class DummyImageGenerator(Backend):
    def generate_image(self, text):
        identicon = generate_identicon(text, image_size=256, grid_size=8)
        return identicon


def generate_identicon(string: str, image_size: int = 256, grid_size: int = 5) -> bytes:
    """
    Generates an identicon-like image derived from a string and returns it as bytes.

    Args:
        string (str): Input string to generate the identicon.
        image_size (int): The size of the output image (in pixels).
        grid_size (int): The number of blocks in the grid (grid_size x grid_size).

    Returns:
        bytes: The generated image in bytes.
    """
    # Hash the input string to get a deterministic pattern
    hash_bytes = hashlib.md5(string.encode()).digest()

    # Convert hash into a deterministic sequence of colors and patterns
    random.seed(hash_bytes)
    base_color = tuple(random.randint(0, 255) for _ in range(3))

    # Create a blank white image
    image = Image.new("RGB", (image_size, image_size), "white")
    draw = ImageDraw.Draw(image)

    # Determine block size
    block_size = image_size // grid_size

    # Generate symmetrical grid
    for row in range(grid_size):
        for col in range((grid_size + 1) // 2):
            if random.choice([True, False]):
                x0 = col * block_size
                y0 = row * block_size
                x1 = x0 + block_size
                y1 = y0 + block_size

                # Draw blocks on both sides to make the identicon symmetrical
                draw.rectangle([x0, y0, x1, y1], fill=base_color)
                mirrored_col = grid_size - 1 - col
                if mirrored_col != col:
                    x0 = mirrored_col * block_size
                    x1 = x0 + block_size
                    draw.rectangle([x0, y0, x1, y1], fill=base_color)

    # Save image to a byte buffer
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer.getvalue()


class DefaultImageGenerator(Backend):
    pass


backends = {
    "dummy": DummyImageGenerator,
    "default": DefaultImageGenerator
}
