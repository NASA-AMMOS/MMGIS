#!/tps/bin/python



#Unit test to verify that all pieces are working. End results matched against expected final database entry.
#Hallie Gengl 

import InstLoc
import unittest



class TestInstLoc(unittest.TestCase):

   def setUp(self):
      self.maxDiff = None

   def test_armInstLocBranch(self):
      #example sol 1614 apxs data product
      armTestFile = 'test_data/APB_540787326ECW16140610924_______M1.DAT'
      armActual = {'Sol': '1614', 'APID': '94', 'Method': '', \
      'RMC': ('61', '924', '16', '36', '0', '0', '398', '110', '0', '0'), \
      'SeqID': 'apxs04500', 'Inst': 'APXS', 'QUAT': ('-0.0312591008842', \
      '0.0374081991613', '0.825723409653', '0.561964809895'), 'ObsType': '', \
      'Eas' : 8141886.709968787, 'Nor': -279260.2788887163, 'APIDName': 'ApxsCwa', 'Stereo': '', \
      'Planetary_Radius': '', 'Sclk': '540787328.0', 'Elev': -4304.638789120783, \
      'LTST': '', 'El': '', 'LMST': '', 'Frame': 'orbital', 'Mission': 'MSL', \
      'OOV': ('-33.4113006592', '37.8059005737', '-4.71968984604'), 'LocType': 'contact', \
      'DataProduct': 'test_data/APB_540787326ECW16140610924_______M1.DAT', 'Az': '', 'Cpnt': ('', '', '')}

 
      self.assertEqual(armActual, InstLoc.InstLocDB(armTestFile))



   def test_mastInstLocBranch(self):
      #example sol 1614 Navcam data product
      mastTestFile = 'test_data/NLB_540789543EDR_F0610924NCAM00207M1.IMG'
      mastActual = {'Sol': '1614', 'APID': '321', 'Method': '', \
      'RMC': ('61', '924', '27', '62', '0', '0', '402', '110', '0', '0'), \
      'SeqID': 'ncam00207', 'Inst': 'NAV_LEFT_B', 'QUAT': ('0.561977028847', \
      '-0.0301290992647', '0.0368766002357', '0.82578098774'), 'ObsType': '', \
      'Eas': 8141887.165005903, 'Nor': -279261.17778639076, 'APIDName': 'ImgImageIcerNl', \
      'Stereo': 'STEREO', 'Planetary_Radius': '', 'Sclk': '540789568.0', \
      'Elev': -4306.554223589337, 'LTST': '', 'El': '-42.7327003479', 'LMST': 'Sol-01614M16:32:22.362', \
      'Frame': 'orbital', 'Mission': 'MSL', 'OOV': ('-33.4113006592', '37.8059005737', '-4.71968984604'), \
      'LocType': 'mast', 'DataProduct': 'test_data/NLB_540789543EDR_F0610924NCAM00207M1.IMG', \
      'Az': '87.8433990479', 'Cpnt': ('0.807569980621', '0.322429001331', '-1.84378004074')}

     
      self.assertEqual(mastActual, InstLoc.InstLocDB(mastTestFile))


   def test_fixedInstLocBranch(self):
      #example sol 1614 DAN data product
      fixedTestFile = 'test_data/DNB_540767866EPA16140610924_______M1.DAT'
      fixedActual = {'Sol': '1614', 'APID': '173', 'Method': '', \
      'RMC': ('61', '924', '8', '0', '0', '0', '202', '110', '0', '0'), \
      'SeqID': 'dan_00015', 'Inst': 'DAN', 'QUAT': ('-0.0314100012183', \
      '0.0379684008658', '0.825713574886', '0.561933219433'), 'ObsType': '', \
      'Eas': 8141884.207746525, 'Nor': -279260.3538141009, 'APIDName': 'DanPassive', \
      'Stereo': '', 'Planetary_Radius': '', 'Sclk': '540767872.0', 'Elev': -4306.938470478244, \
      'LTST': '', 'El': '', 'LMST': '', 'Frame': 'orbital', 'Mission': 'MSL', \
      'OOV': ('-33.4113006592', '37.8059005737', '-4.71968984604'), 'LocType': 'fixed', \
      'DataProduct': 'test_data/DNB_540767866EPA16140610924_______M1.DAT', 'Az': '', 'Cpnt': ('', '', '')}


      self.assertEqual(fixedActual, InstLoc.InstLocDB(fixedTestFile))




if __name__ == "__main__": unittest.main()
