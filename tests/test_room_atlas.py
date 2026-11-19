import sys
from pathlib import Path
import unittest
from PIL import Image

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from build_room_atlas import SIZE, room


class RoomAtlasTest(unittest.TestCase):
    def test_all_views_and_variants_match_the_distributed_image(self):
        path=Path(__file__).resolve().parents[1]/'public/textures/facades/interiery.webp'
        with Image.open(path) as atlas:
            self.assertEqual(atlas.size,(8*SIZE,5*SIZE))
            for variant in range(8):
                for face in range(5):
                    x,y=variant*SIZE,(4-face)*SIZE
                    cell=atlas.crop((x,y,x+SIZE,y+SIZE))
                    self.assertEqual(cell.tobytes(),room(variant,face).tobytes())
