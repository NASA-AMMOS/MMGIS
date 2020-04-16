#!/tps/bin/python

import os
import sys

def PdsToVic(ipds):  # Runs VICAR Transcoder backwards using stylesheet $V2TOP/data/xsl/PDSToVicarMSL1.xsl
   base = os.path.basename(ipds)
   core = os.path.splitext(base)[0]
   TF = "-Djavax.xml.transform.TransformerFactory=org.apache.xalan.processor.TransformerFactoryImpl"
   MSL_TRANSCODER_XSL_FILE_NAME = "$V2TOP/data/xsl/PDSToVicarMSL1.xsl"
   cmd = "java %s -Xmx1024m jpl.mipl.io.jConvertIIO inp=%s out=%s.VIC xml=false format=vicar ri=true xsl=%s" %(TF,ipds,core,MSL_TRANSCODER_XSL_FILE_NAME)
   print "cmd: ",cmd
   os.system(cmd)

