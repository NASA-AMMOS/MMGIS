#! /bin/csh

alias MATH 'set \!:1 = `echo "\!:3-$" | bc -l`'
foreach n (`cat navmos_sol1457.lis`)
set recbytes=`sed 6q $n  | grep RECORD_BYTES | sed 's/.*= //' | tr -cd "[:digit:]"`
set lcount=`head -c $recbytes $n | wc -l`
set rows=`head -$lcount $n | grep LINES | sed 's/.*= //' | tr -cd "[:digit:]"`
set columns=`head -$lcount $n | grep LINE_SAMPLES | sed 's/.*= //' | tr -cd "[:digit:]"`
set bits=`head -$lcount $n | grep SAMPLE_BITS | sed 's/.*= //'  | tr -cd "[:digit:]"`
set bandtype=`head -$lcount $n | grep BAND_STORAGE_TYPE | sed 's/.*= //'  | tr -cd "[:print:]"`
set zeroel=`head -$lcount $n | grep ZERO_ELEVATION_LINE | sed 's/.*= //'  | tr -cd "[:print:]"`
set fname=`basename $n .IMG  | tr -cd "[:print:]"`
set az1=`head -$lcount $n | grep START_AZIMUTH | sed 's/.*= //' | sed 's/ <DEGREES>//' | tr -cd "[:print:]" | sed 's/ //'`
set az2=`head -$lcount $n | grep STOP_AZIMUTH | sed 's/.*= //' | sed 's/ <DEGREES>//' | tr -cd "[:print:]" | sed 's/ //'`
set minel=`head -$lcount $n | grep MINIMUM_ELEVATION | sed 's/.*= //' | sed 's/ <DEGREES>//' | tr -cd "[:print:]" | sed 's/ //'`
set maxel=`head -$lcount $n | grep MAXIMUM_ELEVATION | sed 's/.*= //' | sed 's/ <DEGREES>//' | tr -cd "[:print:]" | sed 's/ //'`
set area=0
MATH pixel = ( $maxel - $minel ) / $columns
MATH pixaz = ( $az2 - $az1 ) / $columns
MATH ulx = ( $az1 + ( $pixaz / 2 ) )
MATH uly = ( $maxel - ( $pixel / 2 ) )
set fileline="nrows "$rows"\n""ncols "$columns"\n""nbits "$bits"\n""byteorder M""\n""layout bsq""\n""skipbytes "$recbytes"\n""ulxmap "$ulx"\n""ulymap "$uly"\n""xdim "$pixaz"\n""ydim "$pixel
echo $fileline >> $fname.hdr
end
