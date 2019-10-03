const glob = require('glob')
const build = require('./build')
const fs = require('fs');

console.log('Creating build file...');

let include = [];
for( let i = 0; i < build.include.length; i++ ) {
    glob(build.include[i], function( er, files ) {
        include = include.concat(files);
    })
}

//lazy
setTimeout( function() {
    let json = build;
    json.include = include;
    json = '(' + JSON.stringify(json) + ')'

    fs.writeFile('finalbuild.js', json, 'utf8', function( err ) {
        if( err ) {
            console.log('An error occured while writing the build file.');
            return console.log(err);
        }
    
        console.log('Ready to build!');
    })
}, 1000 );