<?php
/**
 * Ninja Forms GoDAM Video Settings.
 *
 * @since 1.4.0
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

return array(
	'record_button_text'           => array(
		'name'  => 'record_button_text',
		'type'  => 'textbox',
		'value' => __( 'Record Video', 'godam' ),
		'label' => __( 'Record Video Button Text', 'godam' ),
		'group' => 'primary',
		'width' => 'one-half',
		'help'  => __( 'Button text for recording video.', 'godam' ),
	),
	'max_file_size'                => array(
		'name'  => 'max_file_size',
		'type'  => 'number',
		'label' => __( 'Maximum File Size (MB)', 'godam' ),
		'value' => (int) ( wp_max_upload_size() / ( 1024 * 1024 ) ),
		'width' => 'one-half',
		'group' => 'primary',
		'help'  => __( 'Maximum size of a file that can be uploaded.', 'godam' ),
	),
	'file_selector-local'          => array(
		'name'  => 'file_selector-local',
		'type'  => 'toggle',
		'label' => __( 'Local Files', 'godam' ),
		'width' => 'one-half',
		'group' => 'primary',
		'value' => '',
	),
	'file_selector-screen_capture' => array(
		'name'  => 'file_selector-screen_capture',
		'type'  => 'toggle',
		'label' => __( 'Screen Capture', 'godam' ),
		'width' => 'one-half',
		'group' => 'primary',
		'value' => '1',
	),
	'file_selector-webcam'         => array(
		'name'  => 'file_selector-webcam',
		'type'  => 'toggle',
		'label' => __( 'Webcam', 'godam' ),
		'width' => 'one-half',
		'group' => 'primary',
		'value' => '1',
	),
	'file_selector-audio'          => array(
		'name'  => 'file_selector-audio',
		'type'  => 'toggle',
		'label' => __( 'Audio', 'godam' ),
		'width' => 'one-half',
		'group' => 'primary',
		'value' => '1',
	),
);
