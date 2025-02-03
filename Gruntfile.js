'use strict';
module.exports = function( grunt ) {

    // Load all grunt tasks matching the `grunt-*` pattern
    // Ref. https://npmjs.org/package/load-grunt-tasks
    require( 'load-grunt-tasks' )( grunt );

    grunt.initConfig( {
		// Watch for changes and trigger autoprefixer, cssmin and uglify
		// Ref. https://www.npmjs.com/package/grunt-contrib-watch
        watch: {
            css: {
                files: [ 'admin/css/rt-transcoder-admin.css' ],
                tasks: [ 'autoprefixer', 'cssmin' ]
            },
            js: {
                files: [
                    '<%= uglify.backend.src %>',
                    '<%= uglify.footer.src %>',
                ],
                tasks: [ 'uglify' ]
            }
        },
        // Minify CSS
        // Ref. https://www.npmjs.com/package/grunt-contrib-cssmin
        cssmin: {
            options: {
                style: 'compressed',
                sourcemap: 'none'
            },
            target: {
                files: {
                    'admin/css/rt-transcoder-admin.min.css': 'admin/css/rt-transcoder-admin.css',
                    'admin/css/rt-transcoder-client.min.css': 'admin/css/rt-transcoder-client.css'
                }
            }
        },
        // Autoprefixer - Parse CSS and add vendor-prefixed CSS properties using the Can I Use database.
        // Ref. https://www.npmjs.com/package/grunt-autoprefixer
        autoprefixer: {
            dist: {
                options: {
                    browsers: [ 'last 2 versions', 'ie 9', 'ie 10', 'ios 6', 'android 4' ],
                    expand: true,
                    flatten: true
                },
                files: {
                    'admin/css/rt-transcoder-admin.css': 'admin/css/rt-transcoder-admin.css',
                    'admin/css/rt-transcoder-client.css': 'admin/css/rt-transcoder-client.css'
                }
            }
        },
        // Uglify - Minify JavaScript files with UglifyJS
        // Ref. https://npmjs.org/package/grunt-contrib-uglify
        uglify: {
            options: {
                banner: '/*! \n * Transcoder Library \n * @package Transcoder \n */\n'
            },
            backend: {
                src: [
                    'admin/js/rt-transcoder-admin.js'
                ],
                dest: 'admin/js/rt-transcoder-admin.min.js'
            },
            footer: {
                src: [
                    'admin/js/rt-transcoder.js'
                ],
                dest: 'admin/js/rt-transcoder.min.js'
            }
        },
        // Checktextdomain - Checks gettext function calls for missing or incorrect text domain.
        // Ref. https://www.npmjs.com/package/grunt-checktextdomain
        checktextdomain: {
            options: {
                text_domain: 'godam', //Specify allowed domain(s)
                keywords: [ //List keyword specifications
                    '__:1,2d',
                    '_e:1,2d',
                    '_x:1,2c,3d',
                    'esc_html__:1,2d',
                    'esc_html_e:1,2d',
                    'esc_html_x:1,2c,3d',
                    'esc_attr__:1,2d',
                    'esc_attr_e:1,2d',
                    'esc_attr_x:1,2c,3d',
                    '_ex:1,2c,3d',
                    '_n:1,2,4d',
                    '_nx:1,2,4c,5d',
                    '_n_noop:1,2,3d',
                    '_nx_noop:1,2,3c,4d'
                ]
            },
            target: {
                files: [ {
                    src: [
                            '*.php',
                            '**/*.php',
                            '!node_modules/**',
                            '!tests/**'
                        ], //All php
                    expand: true
                } ]
            }
        },
        // Make POT file - Internationalize WordPress plugins.
        // Ref. https://www.npmjs.com/package/grunt-wp-i18n
        makepot: {
            target: {
                options: {
                    cwd: '.', // Directory of files to internationalize.
                    domainPath: 'languages/', // Where to save the POT file.
                    exclude: [ 'node_modules/*', '.phpintel/*' ], // List of files or directories to ignore.
                    mainFile: 'index.php', // Main project file.
                    potFilename: 'transcoder.pot', // Name of the POT file.
                    potHeaders: { // Headers to add to the generated POT file.
						poedit: true, // Includes common Poedit headers.
						'Last-Translator': 'Transcoder <support@rtcamp.com>',
						'Language-Team': 'Transcoder <support@rtcamp.com>',
						'report-msgid-bugs-to': 'http://community.rtcamp.com/',
						'x-poedit-keywordslist': true // Include a list of all possible gettext functions.
                    },
                    type: 'wp-plugin', // Type of project (wp-plugin or wp-theme).
                    updateTimestamp: true // Whether the POT-Creation-Date should be updated without other changes.
                }
            }
        }

    } );
    // Register task
    grunt.registerTask( 'default', [ 'autoprefixer', 'cssmin', 'uglify', 'checktextdomain', 'makepot', 'watch' ] );
};
