<?php
/**
 * GoDAM Recorder Ninja Forms field.
 *
 * @since n.e.x.t
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Ninja_Forms;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class Ninja_Forms_Godam_Recorder
 *
 * @since n.e.x.t
 */
class Ninja_Forms_Field_Godam_Recorder extends \NF_Abstracts_Field {

	/**
	 * Field type.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	public static $field_type = 'godam_recorder';

	// phpcs:disable PSR2.Classes.PropertyDeclaration.Underscore

	/**
	 * Field parent type.
	 *
	 * @since n.e.x.t
	 *
	 * @access protected
	 *
	 * @var string
	 */
	protected $_parent_type = 'textbox';

	/**
	 * Field section.
	 *
	 * @since n.e.x.t
	 *
	 * @access protected
	 *
	 * @var string
	 */
	protected $_section = 'common';

	/**
	 * Field templates.
	 *
	 * @since n.e.x.t
	 *
	 * @access protected
	 *
	 * @var string
	 */
	protected $_templates = 'godam_recorder';

	/**
	 * Field icon.
	 *
	 * @since n.e.x.t
	 *
	 * @access protected
	 *
	 * @var string
	 */
	protected $_icon = 'file';

	/**
	 * Field test value.
	 *
	 * @since n.e.x.t
	 *
	 * @access protected
	 *
	 * @var bool
	 */
	protected $_test_value = false;

	/**
	 * All settings fields.
	 *
	 * @since n.e.x.t
	 *
	 * @access protected
	 *
	 * @var array
	 */
	protected $_settings_all_fields = array(
		'key',
		'label',
		'label_pos',
		'required',
		'classes',
		'manual_key',
		'description',
	);

	// phpcs:enable PSR2.Classes.PropertyDeclaration.Underscore

	/**
	 * Constructor.
	 *
	 * @since n.e.x.t
	 */
	public function __construct() {

		$this->_name     = self::$field_type;
		$this->_type     = self::$field_type;
		$this->_nicename = __( 'GoDAM Recorder', 'godam' );

		parent::__construct();

		// Load the field settings.
		$settings        = $this->config( 'field-settings' );
		$this->_settings = array_merge( $this->_settings, $settings );

		$this->setup_hooks();
	}

	/**
	 * Setup hooks.
	 *
	 * @return void
	 */
	public function setup_hooks() {
		// Add backend template for the field.
		add_action( 'nf_admin_enqueue_scripts', array( $this, 'add_template' ) );
	}

	/**
	 * Config.
	 *
	 * @param string $file_name File Name to include.
	 *
	 * @since n.e.x.t
	 *
	 * @return mixed
	 */
	private function config( $file_name ) {
		return include RTGODAM_PATH . 'inc/classes/ninja-forms/config/' . $file_name . '.php';
	}

	/**
	 * Add template for the field backend editor.
	 *
	 * @param string $file_name File Name to include.
	 *
	 * @since n.e.x.t
	 *
	 * @return mixed
	 */
	private function template( $file_name ) {
		return include RTGODAM_PATH . 'inc/classes/ninja-forms/templates/' . $file_name;
	}

	/**
	 * Add Template for the field builder.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function add_template() {
		$this->template( 'fields-godam_recorder.html' );
	}
}
