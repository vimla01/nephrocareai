import math
import unittest

from scripts.extract_datasets import egfr_2021_creatinine, egfr_category


class KidneyFunctionsTest(unittest.TestCase):
    def test_egfr_reference_shape(self):
        self.assertAlmostEqual(egfr_2021_creatinine(1.0, 50, False), 91.7, delta=0.2)
        self.assertAlmostEqual(egfr_2021_creatinine(1.0, 50, True), 68.6, delta=0.2)

    def test_invalid_egfr_input(self):
        self.assertTrue(math.isnan(egfr_2021_creatinine(0, 50, False)))
        self.assertTrue(math.isnan(egfr_2021_creatinine(1, 17, False)))

    def test_categories(self):
        expected = [(90, "G1"), (89.9, "G2"), (60, "G2"), (45, "G3a"),
                    (30, "G3b"), (15, "G4"), (14.9, "G5")]
        for value, category in expected:
            self.assertEqual(egfr_category(value), category)


if __name__ == "__main__":
    unittest.main()
