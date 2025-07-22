<?php
/**
 * Register the Uppy Video field for Everest_Forms.
 *
 * @since n.e.x.t
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Everest_Forms;

defined( 'ABSPATH' ) || exit;

if ( class_exists( 'EVF_Form_Fields_Upload' ) ) {
	/**
	 * Everest_Forms GoDAM Video Field Class
	 *
	 * @since n.e.x.t
	 */
	class Everest_Forms_Field_GoDAM_Video extends \EVF_Form_Fields_Upload {

		/**
		 * Field id.
		 *
		 * @since n.e.x.t
		 *
		 * @var sting
		 */
		public $field_id;

		/**
		 * Field data.
		 *
		 * @since n.e.x.t
		 * @var array
		 */
		public $field_data;

		/**
		 * Constructor.
		 *
		 * @since n.e.x.t
		 */
		public function __construct() {
			$this->name     = esc_html__( 'GoDAM Record', 'godam' );
			$this->type     = 'godam_record';
			$this->icon     = 'evf-icon evf-icon-file-upload';
			$this->order    = 40;
			$this->group    = 'advanced';
			$this->settings = array(
				'basic-options'    => array(
					'field_options' => array(
						'label',
						'description',
						'max_size',
						'required',
					),
				),
				'advanced-options' => array(
					'field_options' => array(
						'meta',
						'label_hide',
						'css',
					),
				),
			);

			parent::__construct();
		}

		/**
		 * Define additional field properties.
		 *
		 * @since n.e.x.t
		 *
		 * @param array $properties Field properties.
		 * @param array $field      Field settings.
		 * @param array $form_data  Form data and settings.
		 *
		 * @return array of additional field properties.
		 */
		public function field_properties( $properties, $field, $form_data ) {
			$this->form_data  = (array) $form_data;
			$this->form_id    = absint( $this->form_data['id'] );
			$this->field_id   = $field['id'];
			$this->field_data = $this->form_data['form_fields'][ $this->field_id ];

			// Input Primary: adjust name.
			$properties['inputs']['primary']['attr']['name'] = "evf_{$this->form_id}_{$this->field_id}";

			// Input Primary: max file size.
			$properties['inputs']['primary']['data']['rule-maxsize'] = $this->max_file_size();

			return $properties;
		}
	}
}
