#!/tps/bin/python



#Unit test to verify that all pieces are working. End results matched against expected final database entry.
#Hallie Gengl 

import parseVicarLabel
import unittest



class ParseVicarLabelTestCase(unittest.TestCase):

   def setUp(self):
      self.maxDiff = None
      self.armTestFile   = 'test_data/APB_540787326ECW16140610924_______M1.VIC'
      self.mastTestFile  = 'test_data/NLB_540789543EDR_F0610924NCAM00207M1.IMG'
      self.fixedTestFile = 'test_data/DNB_540767866EPA16140610924_______M1.VIC'


   def test_getPlanetDayNumber(self):

      armActual   = '1614'
      mastActual  = '1614'
      fixedActual = '1614'
 
      self.assertEqual(armActual, parseVicarLabel.getPlanetDayNumber(self.armTestFile))
      self.assertEqual(mastActual, parseVicarLabel.getPlanetDayNumber(self.mastTestFile))
      self.assertEqual(fixedActual, parseVicarLabel.getPlanetDayNumber(self.fixedTestFile))


   def test_getRoverMotionCounter(self):
      #example sol 1614 Navcam data product
      
      mastActual = ('61', '924', '27', '62', '0', '0', '402', '110', '0', '0')
      armActual = ('61', '924', '16', '36', '0', '0', '398', '110', '0', '0')
      fixedActual = ('61', '924', '8', '0', '0', '0', '202', '110', '0', '0')
      
      
      expectedValuesRMC = 10


      self.assertEqual(expectedValuesRMC, len(parseVicarLabel.getRoverMotionCounter(self.armTestFile)))
      self.assertEqual(expectedValuesRMC, len(parseVicarLabel.getRoverMotionCounter(self.mastTestFile)))
      self.assertEqual(expectedValuesRMC, len(parseVicarLabel.getRoverMotionCounter(self.fixedTestFile)))
      
      
      
      self.assertEqual(armActual, parseVicarLabel.getRoverMotionCounter(self.armTestFile))
      self.assertEqual(mastActual, parseVicarLabel.getRoverMotionCounter(self.mastTestFile))
      self.assertEqual(fixedActual, parseVicarLabel.getRoverMotionCounter(self.fixedTestFile))

   

if __name__ == "__main__": unittest.main()
