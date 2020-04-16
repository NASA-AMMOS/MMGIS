#!/tps/bin/python



#Unit test to verify that all pieces are working. End results matched against expected final database entry.
#Hallie Gengl 

import NavMastList
import unittest



class TestInstLoc(unittest.TestCase):

   def setUp(self):
      self.maxDiff = None
      self.mastTestFile = 'test_data/NLB_540789543XYZ_F0610924NCAM00207M1.IMG'

   def test_navMastList(self):


      mastActual = (-33.925404, 40.001129, -5.0128026, 'center')
 
      self.assertEqual(mastActual, NavMastList.NavMastList(self.mastTestFile))








if __name__ == "__main__": unittest.main()
