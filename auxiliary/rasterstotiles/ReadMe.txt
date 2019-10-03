//WINDOWS
Installation:
  Built with:
    Python 2.7 https://www.python.org/downloads/
    GDAL http://www.lfd.uci.edu/~gohlke/pythonlibs/#gdal
    Install the .whl with 'pip install some-package.whl'
      (You may need to upgrade pip)

Usage:
python rasterstotiles.py input.tif



//UBUNTU
GDAL 2.1.0 setup on Ubuntu:

sudo apt-get install build-essential python-all-dev
wget http://download.osgeo.org/gdal/2.1.0/gdal-2.1.0.tar.gz
tar xvfz gdal-2.1.0.tar.gz
cd gdal-2.1.0
./configure --with-python
make
sudo make install

If you see “cannot create XXX.egg-info” permission denied:
Change the permission of all the directories below goal-2.1.0 to 777\
$> find . -type d -exec chmod 777 \{\} \;


If you see the error like this:
ImportError: libgdal.so.20: cannot open shared object file: No such file or directory
add the library path /usr/local/lib/ to /etc/ld.so.conf, then run $ sudo ldconfig

IF you see:
ERROR 6: Unable to load PROJ.4 library (libproj.so), creation of
OGRCoordinateTransformation failed.
Do:
sudo ln -s /usr/lib/libproj.so.0 /usr/lib/libproj.so