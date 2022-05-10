---
layout: page
title: AR and VR
permalink: /miscellaneous/ar-and-vr
parent: Miscellaneous
nav_order: 1
---

# AR and VR

MMGIS offers several immersive ways to better view and understand data through use of virtual and augmented reality.

- [Photosphere](#photosphere)
  - [Requires](#photosphere-requires)
  - [Usage](#photosphere-using)
  - [Development](#photosphere-code)
- [Headset VR](#headset-vr)
  - [Requires](#globevr-requires)
  - [Usage](#globevr-using)
  - [Development](#globevr-code)
- [Globe AR](#globe-ar)
  - [Requires](#globear-requires)
  - [Usage](#globear-using)
  - [Development](#globear-code)

---

### Photosphere

The Viewer's photosphere supports device orientation controls to navigate around its wrapped imagery.

<h4 id="photosphere-requires">Requires</h4>

- A smartphone with an accelerometer
- A modern mobile browser (developed on Chrome)  
  _Caveat_: Some browsers on IPhone at the time of development failed to render high resolution photospheres.

<h4 id="photosphere-using">Usage</h4>

Select a point with mosaic imagery (such as a Waypoint from the MSL mission). Open the Viewer by clicking the left thumb-tab. The bottom-left corner contains a fairly transparent icon of a rotating smartphone; click it to enable device orientation controls. You can now move you phone around to view the photosphere imagery!

<h4 id="photosphere-code">Development</h4>

Uses three.js' [Device Orientation Controls](https://github.com/mrdoob/three.js/blob/dev/examples/js/controls/DeviceOrientationControls.js)

---

### Headset VR

Both the Viewer and Globe have basic support for headset VR. Controls are not supported. The support for Headset VR doesn't get much farther than simply looking around.

<h4 id="globevr-requires">Requires</h4>

_Note_: VR is a quickly moving technology and processes become outdated rather quickly. Check online first to see how to set up GearVR or Oculus for WebVR.

- A [GearVR](https://www.oculus.com/gear-vr/) headset
- A supported GearVR smartphone
- Samsung internet GearVR browser

OR

- An [Oculus Rift](https://www.oculus.com/) headset
- An Oculus Sensor
- A USB gamepad such as an XBox controller
- The [Oculus Desktop App](https://www.oculus.com/setup/)
- [Steam](https://store.steampowered.com/) with SteamVR
- Oculus' default Firefox browser

<h4 id="globevr-using">Usage</h4>

Within a VR browser select a point with mosaic imagery (such as a Waypoint from the MSL mission). Open the Viewer by clicking the left thumb-tab or open the Globe by clicking the right thumb-tab. The bottom-right corner contains a fairly transparent icon of a headset; click it to enter VR and click it again if you wish to exit. You can now look around in VR!

<h4 id="globevr-code">Development</h4>

Uses three.js' vr configurations paired with the headset's utilization of [WebVR](https://webvr.info/).

---

### Globe AR

The Globe has the ability to render terrain such that looking through the phone shows it placed in the user's real world surroundings. Users can then replace, rotate, scale, pan and zoom the terrain. This technology is still experimental but we're confident it'll become standardized within the coming year or so.

<h4 id="globear-requires">Requires</h4>

- A smartphone with ARCore installed and a mobile browser that recognizes and uses it
  - This may not be possible. Current technology (Sept 2018) is only barely starting to support this out-of-the-box.

OR

- Follow [this ReadMe's](https://github.com/google-ar/WebARonARCore) installation for Android
  - The Globe AR was developed using this experimental browser on a Samsung S8 smartphone

<h4 id="globear-using">Usage</h4>

Open your AR supported browser and navigate to https://miplmmgis.nasa.gov/mmgis/MMGIS. Choose a mission and open the globe panel. In the globe panel there's a semi-transparent icon of an eye. Click it to enable AR. _Note_: You may need to allow the page to access you camera first. Point the camera around the room so it can identify surfaces.

Buttons (clockwise and starting from the bottom left corner):

- _Placement mode_: This rounded square should begin filled in. When it's filled in, a magenta square will try to land on the nearest found surface. Clicking anywhere in the middle of the screen will reposition the terrain to that location. Click this button to toggle this mode off for now; you can always retoggle it to place again.
- _Height slider_: The slider just above simply lets you move the terrain up or down for greater placement control.
- _Scale_: This upper-left plus and minus lets you scale the terrain up and down. Press and hold to change scales more quickly. Scalings don't update until these buttons are released.
- _Zoom_: This upper-right plus and minus change the zoom level. This effectively changes the resolution of the terrain.
- _Exit AR_: Finally the eye icon in the lower left exits out of the AR mode.

Joysticks:
While outside of placement mode (this bottom-left square unfilled) each side of the screen corresponds to a joystick.
_Rotate_: Hold down the left side of the screen and drag your finger around to rotate the terrain.
_Pan_: Hold down the right side of the screen and drag you finger around to pan.

<h4 id="globear-code">Development</h4>

Developed on a Samsung S8 Android smartphone and with a Windows 7 computer.

1. The site must be served across `HTTPS`.
1. Enable developer access through the phone's settings.
1. Download the experimental AR browser and ARCore from the [WebARonARCore](https://github.com/google-ar/WebARonARCore) repository.

1. Allow the computer to read data off the phone if prompted.
1. For your computer to properly recognize the phone, install [Minimal ADB and Fastboot](https://forum.xda-developers.com/showthread.php?t=2588979).
1. With the phone plugged in to your computer, navigate to its install directory and run `adb devices`.

1. With the phone still plugged in, open the experimental `WebARonARCore` browser on the phone.
1. Open Chrome and open the developer console.
1. Click the three vertical dots menu and choose "More tools" and click "Remote devices"
1. Wait for Chrome to identify any devices. _Note_: If there many devices, you may need to `ctrl -` to zoom out and find the phone as there isn't a scrollbar.
1. Click on the device corresponding to the phone and then click "Inspect"

You should now see the emulation of the phone as well as its console outputs.
