<?php
/**
 * Ninja Forms GoDAM Video Settings.
 *
 * @since n.e.x.t
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

return array(
	'record_button_text' => array(
		'name'  => 'record_button_text',
		'type'  => 'textbox',
		'value' => __( 'Record Video', 'godam' ),
		'label' => __( 'Record Video Button Text', 'godam' ),
		'group' => 'primary',
		'width' => 'one-half',
		'help'  => __( 'Button text for recording video.', 'godam' ),
	),
	'max_file_size'      => array(
		'name'  => 'max_file_size',
		'type'  => 'number',
		'label' => __( 'Maximum File Size (MB)', 'godam' ),
		'value' => (int) ( wp_max_upload_size() / ( 1024 * 1024 ) ),
		'width' => 'one-half',
		'group' => 'primary',
		'help'  => __( 'Maximum size of a file that can be uploaded.', 'godam' ),
	),
	'file_selector'      => array(
		'name'    => 'file_selector',
		'type'    => 'option-repeater',
		'label'   => __( 'File Selectors', 'godam' ),
		'width'   => 'full',
		'group'   => 'primary',
		'value'   => array(
			array(
				'label'    => 'Option 1',
				'value'    => 'option_1',
				'selected' => 1,
			),
			array(
				'label'    => 'Option 2',
				'value'    => 'option_2',
				'selected' => 1,
			),
			array(
				'label'    => 'Option 3',
				'value'    => 'option_3',
				'selected' => 0,
			),
		),
		'columns' => array(
			'label'    => array(
				'header'  => __( 'Label', 'godam' ),
				'default' => '',
			),
			'value'    => array(
				'header'  => __( 'Value', 'godam' ),
				'default' => '',
			),
			'selected' => array(
				'header'  => '<span class="dashicons dashicons-yes"></span>',
				'default' => 0,
			),
		),
	),
);
