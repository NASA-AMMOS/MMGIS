<?php
    /*
    latlngs_to_demtile_elevs.php takes the first latlng and tries to match it
    to the first demtileset. If the tile is not found or has no data, the
    latlng will then try to be matched with the next demtileset and so on.
    Once found, the next latlng is chosen and so on. Finally the latlngs
    JSON is returned with attached elevation values ... [lat, lng, elev] ...
    */


    //JSON of, at some level, arrays with lngs at index 0 and lats at index 1
    $lnglats = json_decode( $argv[1] );
    
    //JSON of prioritized dem tileset urls and their px dimension size and zoom level to query.
    //{ 'dems/thisdem/{z}/{x}/{y}.png': { 'dim': 32, 'z': 16 }, ... }
    $demtilesets = json_decode( $argv[2], false );

    //Keep track of the last query tile so we need not reload it
    $lastTileUrl = "";


    //To have this work with many different json structues,
    //We first find all the key paths to arrays that are leaves
    $lnglatleaves = array();
    walk_recursive( $lnglats, $lnglatleaves );
    $lnglatleaves = array_unique( $lnglatleaves );
    
        
    function walk_recursive( $array, &$output, $path = null ) {
        foreach( $array as $k => $v ) {
            if( !is_array($v) ) {
                //leaf node
                $fullpath = $path;

                array_push( $output, $fullpath );
            }
            else {
                //node -- recurse
                walk_recursive( $v, $output, $path.'->'.$k );
            }
        }
    }

    //For each latlngleaf
    foreach( $lnglatleaves as $keyl => $vall ) {
        //find the actual (reference) lnglat leaf to work on
        $explll = explode( '->', $lnglatleaves[$keyl] );
        $ll = &$lnglats;
        for( $k = 1; $k < sizeof( $explll ); $k++ ) {
            if( is_array($ll) ) {
                $ll = &$ll[$explll[$k]];
            }
            else {
                $ll = &$ll->$explll[$k];
            }
        }

        //If it's a two valued array
        if( is_array($ll) && sizeof($ll) >= 2 ) {
            //For each demtileset (break on success)
            //for( $d = 0; $d < sizeOf($demtilesets); $d++ ) {
            foreach( $demtilesets as $key => $val ) {
                //Find the image
                $x = lon2tileUnfloored( $ll[0], $demtilesets->$key->z );
                $y = lat2tileUnfloored( $ll[1], $demtilesets->$key->z );
                $tileX = floor( $x );
                $tileY = floor( $y );

                //Find the pixel x y
                $pixelX = round( ( $x - $tileX ) * $demtilesets->$key->dim );
                $pixelY = round( ( $y - $tileY ) * $demtilesets->$key->dim );

                //Invert y
                $tileY = pow( 2, $demtilesets->$key->z ) - 1 - $tileY;

                //Get tile url
                $tileUrl = $key;
                $tileUrl = str_ireplace( '{z}', $demtilesets->$key->z, $tileUrl );
                $tileUrl = str_ireplace( '{x}', $tileX, $tileUrl );
                $tileUrl = str_ireplace( '{y}', $tileY, $tileUrl );

                //Get the pixel color at x y
                if( $tileUrl != $lastTileUrl ) {
                    $tileImg = imagecreatefrompng( $tileUrl );
                }
                $lastTileUrl = $tileUrl;

                $rgba = imagecolorat( $tileImg, $pixelX, $pixelY );
                
                if( !is_null( $rgba ) ) {
                    $red = ($rgba & 0xFF0000) >> 16;
                    $green = ($rgba & 0x00FF00) >> 8;
                    $blue = ($rgba & 0x0000FF);
                    //ONLY 7 BITS! and 127 is transparent
                    $alpha = ($rgba & 0x7F000000) >> 24;
                    //So fix the alpha (invert and scale to 255)
                    $alpha = $alpha * 2; //0 to 254
                    $alpha = 255 - $alpha;

                    //Convert it to meters
                    $elevation = rgbaToMeters( $red, $green, $blue, $alpha );
                    //Attach it the latlng
                    $ll[2] = $elevation;

                    break;
                }
            }
        }
    }

    echo json_encode( $lnglats );


    ///
    function lon2tileUnfloored( $lon, $zoom ) {
        return ( $lon + 180 ) / 360 * pow( 2, $zoom );
    }
    function lat2tileUnfloored( $lat, $zoom ) {
        $n = $lat * pi() / 180;
        return ( ( 1 - log( tan( $n ) + 1 / cos( $n ) ) / pi() ) / 2 * pow( 2, $zoom ) );
    }

    ///
    function rgbaToMeters( $r, $g, $b, $a ) {
        return decodeFloat( asByteString( decbin($r) ) . asByteString( decbin($g) ) .
            asByteString( decbin($b) ) . asByteString( decbin($a) ) );
    }
    function asByteString( $byte ) {
        $byteString = $byte;
        while( strlen($byteString) < 8 ) {
            $byteString = "0" . $byteString;
        }
        return $byteString;
    }
    function decodeFloat( $binary ) {
        if( strlen($binary) < 32 ) {
            $binary = substr( '00000000000000000000000000000000'. $binary, strlen($binary) );
        }

        $sign = ( $binary[0] == '1' ? -1 : 1 );
        $exponent = bindec( substr( $binary, 1, 8) ) - 127;
        $significandBase = substr( $binary, 9 );
        $significandBin = '1' . $significandBase;
        $i = 0;
        $val = 1;
        $significand = 0;

        if( $exponent == -127 ) {
            if( strpos( $significandBase, '1' ) == false ) {
                return 0;
            }
            else {
                $exponent = -126;
                $significandBin = '0' . $significandBase;
            }
        }

        $significand = (float)$significand;
        while( $i < strlen($significandBin) ) {
            $significand += ( $val * (int)$significandBin[$i] );
            $val = $val / 2;
            $i++;
        }
        
        return $sign * $significand * pow( 2, $exponent );
    }
?>