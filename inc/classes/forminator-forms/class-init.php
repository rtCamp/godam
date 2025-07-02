<?php
/**
 * Initialize Forminator integration
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Forminator_Forms;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class Init
 *
 * @package GoDAM
 */
class Init {

	use Singleton;

	/**
	 * Constructor method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup hooks.
	 *
	 * @return void
	 */
	public function setup_hooks() {
		// Register the field.
		add_filter( 'forminator_fields', array( $this, 'register_forminator_field' ) );

		// Handle form submission with GoDAM recorder field.
		add_action( 'forminator_custom_form_submit_before_set_fields', array( $this, 'process_file_upload_to_godam' ), 10, 3 );
	}

	/**
	 * Register GoDAM recorder field
	 *
	 * @param array $fields The forminator fields.
	 * @return array
	 */
	public function register_forminator_field( $fields ) {
		// Include the field class file.
		require_once __DIR__ . '/class-forminator-godam-record.php';

		// Add the field to the fields array.
		$fields[] = new Forminator_GoDAM_Record();

		return $fields;
	}

	/**
	 * Process file upload to GoDAM.
	 *
	 * @param array $entry   The entry data.
	 * @param int   $form_id The form ID.
	 * @param array $fields  The submitted fields.
	 */
	public function process_file_upload_to_godam( $entry, $form_id, $fields ) {
		// $form_data = forminator_get_custom_form( $form_id );
		// TODO: Used for debugging purposes, remove later.
		// Simulating form data for testing.
		$form_data = (object) array(
			'settings' => array(
				'formName' => 'Test Form',
			),
			'raw'      => wp_json_encode(
				array(
					'fields' => array(
						array(
							'element_id' => 'field_1',
							'type'       => 'godam_record',
							'settings'   => array(
								'godam_video_sync' => true,
							),
						),
					),
				)
			),
		);

		if ( ! $form_data || ! isset( $form_data->settings ) || empty( $form_data->raw ) ) {
			return;
		}

		// Form title for folder name.
		$form_title = ! empty( $form_data->settings['formName'] ) ? $form_data->settings['formName'] : 'Forminator Form ' . $form_id;

		// Process GoDAM recorder fields.
		foreach ( $fields as $field_id => $field_value ) {
			$field_type = $this->get_field_type( $form_data, $field_id );
			
			// Skip if not GoDAM recorder field.
			if ( 'godam_record' !== $field_type ) {
				continue;
			}

			// Skip if field is empty.
			if ( empty( $field_value ) ) {
				continue;
			}

			$field_settings = $this->get_field_settings( $form_data, $field_id );
			
			// Check if sync to GoDAM is enabled.
			$sync_to_godam = isset( $field_settings['godam_video_sync'] ) && $field_settings['godam_video_sync'];
			
			if ( ! $sync_to_godam ) {
				continue;
			}

			// Process the file.
			$file_url = $field_value;
			
			if ( ! empty( $file_url ) ) {
				$this->send_to_godam( $form_title, $file_url, $entry['entry_id'], $field_id );
			}
		}
	}

	/**
	 * Get field type by ID.
	 *
	 * @param object $form      Form object.
	 * @param string $field_id  Field ID.
	 * @return string|null
	 */
	private function get_field_type( $form, $field_id ) {
		$raw_form = json_decode( $form->raw );
		
		if ( ! isset( $raw_form->fields ) || ! is_array( $raw_form->fields ) ) {
			return null;
		}
		
		foreach ( $raw_form->fields as $field ) {
			if ( isset( $field->element_id ) && $field->element_id === $field_id ) {
				return $field->type;
			}
		}
		
		return null;
	}

	/**
	 * Get field settings by ID.
	 *
	 * @param object $form      Form object.
	 * @param string $field_id  Field ID.
	 * @return array
	 */
	private function get_field_settings( $form, $field_id ) {
		$raw_form = json_decode( $form->raw );
		
		if ( ! isset( $raw_form->fields ) || ! is_array( $raw_form->fields ) ) {
			return array();
		}
		
		foreach ( $raw_form->fields as $field ) {
			if ( isset( $field->element_id ) && $field->element_id === $field_id ) {
				return (array) $field;
			}
		}
		
		return array();
	}

	/**
	 * Send the file to GoDAM.
	 *
	 * @param string $form_title Form title.
	 * @param string $file_url   File URL.
	 * @param int    $entry_id   Entry ID.
	 * @param string $field_id   Field ID.
	 * @param int    $index      File index.
	 * @return bool
	 */
	private function send_to_godam( $form_title, $file_url, $entry_id, $field_id, $index = 0 ) {
		if ( ! function_exists( 'rtgodam_is_api_key_valid' ) || ! rtgodam_is_api_key_valid() ) {
			return false;
		}

		// Get file extension.
		$file_extension = pathinfo( $file_url, PATHINFO_EXTENSION );

		$default_settings = array(
			'video' => array(
				'adaptive_bitrate'     => true,
				'watermark'            => false,
				'watermark_text'       => '',
				'watermark_url'        => '',
				'video_thumbnails'     => 0,
				'overwrite_thumbnails' => false,
				'use_watermark_image'  => false,
			),
		);

		$godam_settings = get_option( 'rtgodam-settings', $default_settings );

		$rtgodam_watermark           = $godam_settings['video']['watermark'];
		$rtgodam_use_watermark_image = $godam_settings['video']['use_watermark_image'];
		$rtgodam_watermark_text      = sanitize_text_field( $godam_settings['video']['watermark_text'] );
		$rtgodam_watermark_url       = esc_url_raw( $godam_settings['video']['watermark_url'] );

		$watermark_to_use = array();
		if ( $rtgodam_watermark ) {
			if ( $rtgodam_use_watermark_image ) {
				$watermark_to_use = array(
					'watermark_url' => $rtgodam_watermark_url,
				);
			} else {
				$watermark_to_use = array(
					'watermark_text' => $rtgodam_watermark_text,
				);
			}
		}

		$callback_url        = home_url( '/?rtgodam-callback=true' );
		$status_callback_url = admin_url( 'admin-ajax.php?action=rtgodam_handle_status_callback' );

		$api_key = get_site_option( 'rtgodam-api-key', '' );

		$body = array_merge(
			array(
				'api_token'       => $api_key,
				'job_type'        => 'stream',
				'job_for'         => 'forminator-godam-recorder',
				'file_origin'     => rawurlencode( $file_url ),
				'callback_url'    => rawurlencode( $callback_url ),
				'status_callback' => rawurlencode( $status_callback_url ),
				'force'           => 0,
				'formats'         => $file_extension,
				'thumbnail_count' => 0,
				'stream'          => true,
				'watermark'       => boolval( $rtgodam_watermark ),
				'resolutions'     => array( 'auto' ),
				'folder_name'     => $form_title ?? 'Forminator Forms',
			),
			$watermark_to_use
		);

		$args = array(
			'method'    => 'POST',
			'sslverify' => false,
			'timeout'   => 60,
			'body'      => $body,
		);

		$transcoding_api_url = RTGODAM_API_BASE . '/api/';
		$transcoding_url     = $transcoding_api_url . 'resource/Transcoder Job';

		$upload_page = wp_remote_post( $transcoding_url, $args );

		if ( ! is_wp_error( $upload_page ) && 
			(
				isset( $upload_page['response']['code'] ) &&
				200 === intval( $upload_page['response']['code'] )
			)
		) {
			$upload_info = json_decode( $upload_page['body'] );

			if ( isset( $upload_info->data ) && isset( $upload_info->data->name ) ) {
				$job_id = $upload_info->data->name;
				update_option( 'forminator_rtgodam_transcoding_job_id_' . $entry_id . '_' . $field_id . '_' . $index, $job_id );
				add_option(
					'rtgodam_transcoding_data_' . $job_id,
					array(
						'source'   => 'forminator_godam_recorder',
						'entry_id' => $entry_id,
						'field_id' => $field_id,
						'index'    => $index,
					)
				);
				return true;
			}
		}

		return false;
	}
}
