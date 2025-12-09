<?php
/**
 * Register REST API endpoints for Jetpack Forms.
 *
 * Get all Jetpack Forms and a single Jetpack Form.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use Automattic\Jetpack\Forms\ContactForm\Contact_Form;

/**
 * Class Jetpack
 */
class Jetpack extends Base {

	/**
	 * REST route base.
	 *
	 * @var string
	 */
	protected $rest_base = '';

	/**
	 * Batch size for fetching Jetpack forms.
	 *
	 * @var integer
	 */
	protected $batch_size = 50;

	/**
	 * Cache key for Jetpack forms.
	 *
	 * @var string
	 */
	protected $cache_key = 'rtgodam_jetpack_fetched_forms';

	/**
	 * Cache expiry for Jetpack forms.
	 *
	 * @var integer
	 */
	protected $cache_expiry = DAY_IN_SECONDS;

	/**
	 * Setup hooks and initialization.
	 */
	protected function setup_hooks() {

		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
		
		// Hook cache invalidation to post actions.
		add_action( 'save_post', array( $this, 'invalidate_cache' ) );
		add_action( 'deleted_post', array( $this, 'invalidate_cache' ) );
		add_action( 'wp_trash_post', array( $this, 'invalidate_cache' ) );
	}

	/**
	 * Get REST routes.
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/jetpack-forms',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_jetpack_forms' ),
						'permission_callback' => '__return_true',
						'args'                => $this->get_collection_params(),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/jetpack-form',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_jetpack_form' ),
						'permission_callback' => '__return_true',
						'args'                => array_merge(
							$this->get_collection_params(),
							array(
								'id' => array(
									'description'       => __( 'The ID of the Jetpack Form.', 'godam' ),
									'type'              => 'string',
									'required'          => true,
									'sanitize_callback' => 'sanitize_key',
								),
							)
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/jetpack-form-submit',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::CREATABLE,
						'callback'            => array( $this, 'submit_jetpack_form' ),
						'permission_callback' => '__return_true',
						'args'                => array(
							'contact-form-id'   => array(
								'description'       => __( 'The contact form ID.', 'godam' ),
								'type'              => 'string',
								'required'          => true,
								'sanitize_callback' => 'sanitize_key',
							),
							'contact-form-hash' => array(
								'description'       => __( 'The contact form hash.', 'godam' ),
								'type'              => 'string',
								'required'          => true,
								'sanitize_callback' => 'sanitize_text_field',
							),
							'origin-post-id'    => array(
								'description'       => __( 'The origin post ID.', 'godam' ),
								'type'              => 'string',
								'required'          => false,
								'sanitize_callback' => 'sanitize_key',
							),
							'fields'            => array(
								'description' => __( 'The form fields data as JSON string.', 'godam' ),
								'type'        => 'string',
								'required'    => true,
								'default'     => '{}',
							),
						),
					),
				),
			),
		);
	}

	/**
	 * Get all Jetpack Forms.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_jetpack_forms( $request ) {
		// Check if Jetpack plugin is active.
		if ( ! class_exists( 'Jetpack' ) ) {
			return new \WP_Error( 'jetpack_not_active', __( 'Jetpack plugin is not active.', 'godam' ), array( 'status' => 404 ) );
		}

		// Try to get from cache first.
		$cached = get_transient( $this->cache_key );
		if ( false !== $cached ) {
			return rest_ensure_response( $cached );
		}

		global $wpdb;

		$batch_size    = $this->batch_size;
		$offset        = 0;
		$jetpack_forms = array();

		do {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$posts_with_forms = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT DISTINCT p.ID, p.post_title, p.post_content 
					FROM {$wpdb->posts} p 
					WHERE p.post_status = 'publish'
					AND p.post_type IN ( 'page', 'post' )
					AND p.post_content LIKE %s
					LIMIT %d OFFSET %d",
					'%wp:jetpack/contact-form%',
					$batch_size,
					$offset
				)
			);

			if ( empty( $posts_with_forms ) ) {
				break;
			}

			foreach ( $posts_with_forms as $post ) {
				// Parse blocks to find Jetpack forms.
				$blocks        = parse_blocks( $post->post_content );
				$forms_in_post = $this->extract_jetpack_forms_from_blocks( $blocks, $post->ID, $post->post_title );

				foreach ( $forms_in_post as $form ) {
					$form_data       = array(
						'id'             => $form['id'],
						'title'          => $form['title'],
						'post_id'        => $post->ID,
						'post_title'     => $post->post_title,
						'origin_post_id' => $post->ID,
					);
					$jetpack_forms[] = $form_data;
				}
			}

			$offset     += $batch_size;
			$posts_count = count( $posts_with_forms );
		} while ( $posts_count === $batch_size );

		// Cache the result for 1 day.
		set_transient( $this->cache_key, $jetpack_forms, $this->cache_expiry );

		return rest_ensure_response( $jetpack_forms );
	}

	/**
	 * Recursively extract Jetpack forms from blocks.
	 *
	 * @param array  $blocks The blocks to search.
	 * @param int    $post_id The post ID.
	 * @param string $post_title The post title.
	 * @return array Array of found forms.
	 */
	private function extract_jetpack_forms_from_blocks( $blocks, $post_id, $post_title ) {
		$forms        = array();
		$form_counter = 1;

		$this->search_blocks_for_forms( $blocks, $post_id, $post_title, $forms, $form_counter );

		return $forms;
	}

	/**
	 * Helper method to recursively search blocks for forms.
	 *
	 * @param array  $blocks The blocks to search.
	 * @param int    $post_id The post ID.
	 * @param string $post_title The post title.
	 * @param array  &$forms Reference to forms array.
	 * @param int    &$form_counter Reference to form counter.
	 */
	private function search_blocks_for_forms( $blocks, $post_id, $post_title, &$forms, &$form_counter ) {
		foreach ( $blocks as $block ) {
			// Check if this is a Jetpack contact form block.
			if ( 'jetpack/contact-form' === $block['blockName'] ) {
				// Generate a unique ID for this form.
				$form_id = $post_id . '-' . $form_counter;

				// Extract form title from attributes or generate one.
				$form_title = '';
				// Create a more descriptive title.
				$form_title = $post_title;
				
				// If there are multiple forms in the same post, add numbering.
				if ( $form_counter > 1 ) {
					$form_title .= ' (Form ' . $form_counter . ')';
				}
				
				// Add the post ID for uniqueness.
				$form_title .= ' (Post ID: ' . $post_id . ')';
				

				$forms[] = array(
					'id'      => $form_id,
					'title'   => $form_title,
					'content' => serialize_block( $block ),
					'block'   => $block,
				);

				++$form_counter;
			}

			// Recursively search in inner blocks.
			if ( ! empty( $block['innerBlocks'] ) ) {
				$this->search_blocks_for_forms( $block['innerBlocks'], $post_id, $post_title, $forms, $form_counter );
			}
		}
	}

	/**
	 * Get a single Jetpack Form.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_jetpack_form( $request ) {
		// Check if Jetpack plugin is active.
		if ( ! class_exists( 'Jetpack' ) || ! class_exists( 'Automattic\Jetpack\Forms\ContactForm\Contact_Form' ) ) {
			return new \WP_Error( 'jetpack_not_active', __( 'Jetpack plugin is not active.', 'godam' ), array( 'status' => 404 ) );
		}

		$form_id = $request->get_param( 'id' );

		if ( empty( $form_id ) ) {
			return new \WP_Error( 'invalid_form_id', __( 'Invalid form ID.', 'godam' ), array( 'status' => 404 ) );
		}

		// Parse the form ID to get post ID and form number.
		$form_parts = explode( '-', $form_id );
		if ( count( $form_parts ) < 2 ) {
			return new \WP_Error( 'invalid_form_id', __( 'Invalid form ID format.', 'godam' ), array( 'status' => 404 ) );
		}

		$post_id     = intval( $form_parts[0] );
		$form_number = intval( $form_parts[1] );

		// Get the post content.
		$post = get_post( $post_id );
		if ( ! $post ) {
			return new \WP_Error( 'post_not_found', __( 'Post not found.', 'godam' ), array( 'status' => 404 ) );
		}

		// Parse blocks and find the specific form.
		$blocks     = parse_blocks( $post->post_content );
		$form_block = $this->find_form_block_by_number( $blocks, $form_number );

		if ( ! $form_block ) {
			return new \WP_Error( 'form_not_found', __( 'Form not found.', 'godam' ), array( 'status' => 404 ) );
		}

		// Generate the actual form HTML using Jetpack's Contact_Form class.
		$form_content = $this->render_jetpack_form_directly( $form_block, $post_id );

		if ( ! $form_content ) {
			return new \WP_Error( 'form_render_failed', __( 'Failed to render form.', 'godam' ), array( 'status' => 500 ) );
		}

		return rest_ensure_response( $form_content );
	}

	/**
	 * Find a specific form block by its number in the blocks.
	 *
	 * @param array $blocks The blocks to search.
	 * @param int   $form_number The form number to find.
	 * @return array|false The form block or false if not found.
	 */
	private function find_form_block_by_number( $blocks, $form_number ) {
		$current_form_number = 1;
		return $this->search_for_form_block_by_number( $blocks, $form_number, $current_form_number );
	}

	/**
	 * Helper method to recursively search for a form block by number.
	 *
	 * @param array $blocks The blocks to search.
	 * @param int   $target_form_number The form number to find.
	 * @param int   &$current_form_number Reference to current form counter.
	 * @return array|false The form block or false if not found.
	 */
	private function search_for_form_block_by_number( $blocks, $target_form_number, &$current_form_number ) {
		foreach ( $blocks as $block ) {
			// Check if this is a Jetpack contact form block.
			if ( 'jetpack/contact-form' === $block['blockName'] ) {
				if ( $current_form_number === $target_form_number ) {
					return $block;
				}
				++$current_form_number;
			}

			// Recursively search in inner blocks.
			if ( ! empty( $block['innerBlocks'] ) ) {
				$result = $this->search_for_form_block_by_number( $block['innerBlocks'], $target_form_number, $current_form_number );
				if ( false !== $result ) {
					return $result;
				}
			}
		}

		return false;
	}

	/**
	 * Render a Jetpack form directly using the Contact_Form class.
	 *
	 * @param array $form_block The form block data.
	 * @param int   $post_id The post ID containing the form.
	 * @return string|false The rendered form HTML or false on error.
	 */
	private function render_jetpack_form_directly( $form_block, $post_id ) {
		if ( ! class_exists( 'Automattic\Jetpack\Forms\ContactForm\Contact_Form' ) ) {
			return false;
		}

		// Store current post state.
		$target_post = get_post( $post_id );
		if ( ! $target_post ) {
			return false;
		}

		// Enable Jetpack form styling.
		\Automattic\Jetpack\Forms\ContactForm\Contact_Form::style_on();

		try {
			// Prepare form attributes.
			$form_attrs       = $form_block['attrs'] ?? array();
			$form_attrs['id'] = $post_id;

			// Process inner blocks to get form content.
			$form_content = '';
			if ( ! empty( $form_block['innerBlocks'] ) ) {
				foreach ( $form_block['innerBlocks'] as $inner_block ) {
					$form_content .= render_block( $inner_block );
				}
			}

			// Create and parse the form using Jetpack's Contact_Form class.
			$form_html = \Automattic\Jetpack\Forms\ContactForm\Contact_Form::parse( $form_attrs, $form_content );

			return $form_html;
		} catch ( \Exception $e ) {
			return false;
		}
	}

	/**
	 * Static helper method to get rendered form HTML (for use in templates).
	 *
	 * @param string $form_id The form ID.
	 * @return string|false The rendered HTML or false on error.
	 */
	public static function get_rendered_form_html_static( $form_id ) {
		// Check if Jetpack plugin is active.
		if ( ! class_exists( 'Jetpack' ) || ! class_exists( 'Automattic\Jetpack\Forms\ContactForm\Contact_Form' ) ) {
			return false;
		}

		// Parse the form ID to get post ID and form number.
		$form_parts = explode( '-', $form_id );
		if ( count( $form_parts ) < 2 ) {
			return false;
		}

		$post_id     = intval( $form_parts[0] );
		$form_number = intval( $form_parts[1] );

		// Get the post content.
		$post = get_post( $post_id );
		if ( ! $post ) {
			return false;
		}

		// Parse blocks and find the specific form.
		$blocks     = parse_blocks( $post->post_content );
		$form_block = self::find_form_block_by_number_static( $blocks, $form_number );

		if ( ! $form_block ) {
			return false;
		}

		// Generate the actual form HTML.
		$form_content = self::render_jetpack_form_directly_static( $form_block, $post_id );

		if ( ! $form_content ) {
			return false;
		}

		return $form_content;
	}

	/**
	 * Static helper method to find form block by number in blocks.
	 *
	 * @param array $blocks The blocks to search.
	 * @param int   $form_number The form number to find.
	 * @return array|false The form block or false if not found.
	 */
	private static function find_form_block_by_number_static( $blocks, $form_number ) {
		$current_form_number = 1;
		return self::search_for_form_block_by_number_static( $blocks, $form_number, $current_form_number );
	}

	/**
	 * Static helper method to recursively search for a form block by number.
	 *
	 * @param array $blocks The blocks to search.
	 * @param int   $target_form_number The form number to find.
	 * @param int   &$current_form_number Reference to current form counter.
	 * @return array|false The form block or false if not found.
	 */
	private static function search_for_form_block_by_number_static( $blocks, $target_form_number, &$current_form_number ) {
		foreach ( $blocks as $block ) {
			// Check if this is a Jetpack contact form block.
			if ( 'jetpack/contact-form' === $block['blockName'] ) {
				if ( $current_form_number === $target_form_number ) {
					return $block;
				}
				++$current_form_number;
			}

			// Recursively search in inner blocks.
			if ( ! empty( $block['innerBlocks'] ) ) {
				$result = self::search_for_form_block_by_number_static( $block['innerBlocks'], $target_form_number, $current_form_number );
				if ( false !== $result ) {
					return $result;
				}
			}
		}

		return false;
	}

	/**
	 * Static helper method to render Jetpack form directly.
	 *
	 * @param array $form_block The form block data.
	 * @param int   $post_id The post ID containing the form.
	 * @return string|false The rendered form HTML or false on error.
	 */
	private static function render_jetpack_form_directly_static( $form_block, $post_id ) {
		if ( ! class_exists( 'Automattic\Jetpack\Forms\ContactForm\Contact_Form' ) ) {
			return false;
		}

		// Store current post state.
		$target_post = get_post( $post_id );
		if ( ! $target_post ) {
			return false;
		}

		// Enable Jetpack form styling.
		\Automattic\Jetpack\Forms\ContactForm\Contact_Form::style_on();

		try {
			// Prepare form attributes.
			$form_attrs       = $form_block['attrs'] ?? array();
			$form_attrs['id'] = $post_id;

			// Process inner blocks to get form content.
			$form_content = '';
			if ( ! empty( $form_block['innerBlocks'] ) ) {
				foreach ( $form_block['innerBlocks'] as $inner_block ) {
					$form_content .= render_block( $inner_block );
				}
			}

			// Create and parse the form using Jetpack's Contact_Form class.
			$form_html = \Automattic\Jetpack\Forms\ContactForm\Contact_Form::parse( $form_attrs, $form_content );

			return $form_html;
		} catch ( \Exception $e ) {
			return false;
		}
	}

	/**
	 * Handle Jetpack form submission via REST API.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function submit_jetpack_form( $request ) {
		
		if ( ! class_exists( '\Automattic\Jetpack\Forms\ContactForm\Contact_Form' ) ) {
			return new \WP_Error( 'jetpack_not_active', __( 'Jetpack plugin is not active.', 'godam' ), array( 'status' => 404 ) );
		}

		$form_id        = $request->get_param( 'contact-form-id' );
		$form_hash      = $request->get_param( 'contact-form-hash' );
		$fields         = $request->get_param( 'fields' );
		$origin_post_id = $request->get_param( 'origin-post-id' );

		// Parse the fields JSON if it's a string.
		if ( is_string( $fields ) ) {
			$fields = json_decode( $fields, true );
		}
		
		// Ensure fields is an array.
		if ( ! is_array( $fields ) ) {
			$fields = array();
		}

		// Use origin post ID if provided, otherwise fall back to parsing form ID.
		$target_post_id = null;
		if ( ! empty( $origin_post_id ) ) {
			$target_post_id = intval( $origin_post_id );
		} else {
			// Fallback: parse form ID to get post ID (for backward compatibility).
			$form_parts     = explode( '-', $form_id );
			$target_post_id = intval( $form_parts[0] );
		}

		// Ensure the form is loaded into memory using the origin post ID.
		$form_loaded = $this->load_form_into_memory_with_origin( $form_id, $form_hash, $target_post_id );
		
		if ( ! $form_loaded ) {
			return new \WP_Error( 'form_not_found', __( 'Form not found or could not be loaded.', 'godam' ), array( 'status' => 404 ) );
		}

		// Use the correct hash from the original form.
		global $godam_correct_form_hash;
		if ( isset( $godam_correct_form_hash ) ) {
			$form_hash = $godam_correct_form_hash;
		}

		// Verify the form is now in memory.
		if ( ! isset( Contact_Form::$forms[ $form_hash ] ) ) {
			return new \WP_Error( 'form_not_found', __( 'Form not found in memory.', 'godam' ), array( 'status' => 404 ) );
		}

		// Get the original form to map field names and get correct form ID.
		$original_form = Contact_Form::$forms[ $form_hash ];
		$mapped_fields = $this->map_field_names( $fields, $original_form );
		
		// Get the correct form ID from the original form.
		$correct_form_id = $original_form->attributes['id'];

		// Prepare $_POST data as Jetpack expects.
		$_POST['action']            = 'grunion-contact-form';
		$_POST['contact-form-id']   = $correct_form_id; // Use the correct form ID.
		$_POST['contact-form-hash'] = $form_hash;

		// Add mapped form fields to $_POST.
		foreach ( $mapped_fields as $key => $value ) {
			$_POST[ $key ] = $value;
		}

		// Set field values on the field objects (nonce verification handled by Jetpack).
		foreach ( $original_form->fields as $field_id => $field ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Missing -- handled by Jetpack.
			if ( isset( $_POST[ $field_id ] ) ) { 
				// phpcs:ignore WordPress.Security.NonceVerification.Missing -- handled by Jetpack.
				$field->value = sanitize_text_field( wp_unslash( $_POST[ $field_id ] ) );
			}
		}

		// Add required fields.
		$_POST['_wpnonce']         = wp_create_nonce( "contact-form_{$correct_form_id}" );
		$_POST['_wp_http_referer'] = home_url();

		// Process the form submission directly instead of using ajax_request().
		$result = $this->process_jetpack_form_submission( $original_form );

		return rest_ensure_response( $result );
	}

	/**
	 * Process Jetpack form submission and return appropriate response.
	 *
	 * @param object $form The Jetpack form object.
	 * @return array Response data.
	 */
	private function process_jetpack_form_submission( $form ) {
		try {
			// Validate the form.
			$validation_result = $this->validate_jetpack_form( $form );
			
			if ( ! $validation_result['valid'] ) {
				return array(
					'success' => false,
					'message' => $validation_result['message'],
				);
			}

			// Set DOING_AJAX constant to ensure process_submission returns success message.
			if ( ! defined( 'DOING_AJAX' ) ) {
				define( 'DOING_AJAX', true );
			}
			
			// Process the submission using Jetpack's built-in method.
			$submission_result = $form->process_submission();
			
			if ( $submission_result ) {
				// Get custom success message from form attributes.
				$custom_heading = $form->get_attribute( 'customThankyouHeading' );
				$custom_message = $form->get_attribute( 'customThankyouMessage' );
				
				// Use custom messages if available, otherwise use defaults.
				$heading = ! empty( $custom_heading ) ? $custom_heading : __( 'Success!', 'godam' );
				$message = ! empty( $custom_message ) ? $custom_message : __( 'Your message has been sent successfully.', 'godam' );
				
				$response = array(
					'success' => true,
					'heading' => $heading,
					'message' => $message,
				);
				
				return $response;
			} else {
				return array(
					'success' => false,
					'message' => __( 'An error occurred while sending your message. Please try again.', 'godam' ),
				);
			}
		} catch ( \Exception $e ) {
			return array(
				'success' => false,
				'message' => __( 'An unexpected error occurred. Please try again.', 'godam' ),
				'error'   => $e->getMessage(),
			);
		}
	}

	/**
	 * Validate Jetpack form fields.
	 *
	 * @param object $form The Jetpack form object.
	 * @return array Validation result.
	 */
	private function validate_jetpack_form( $form ) {
		$errors = array();
		$valid  = true;

		foreach ( $form->fields as $field_id => $field ) {
			// Call the field's validate method.
			$field->validate();
			
			if ( $field->is_error() ) {
				$valid       = false;
				$field_label = $field->get_attribute( 'label' );
				if ( empty( $field_label ) ) {
					$field_label = ucfirst( str_replace( array( 'g' . $form->get_attribute( 'id' ) . '-', '-' ), array( '', ' ' ), $field_id ) );
				}
				// translators: %s is the field label.
				$errors[] = sprintf( __( 'Valid %s is required.', 'godam' ), $field_label );
			}
		}

		$error_count = count( $errors );
		$error_text  = 1 === $error_count ? __( 'error', 'godam' ) : __( 'errors', 'godam' );
		
		$result = array(
			'valid'   => $valid,
			'message' => $valid ? '' : sprintf( 
				// translators: %d is the number of errors, %s is the error text, %s is the list of errors.
				__( 'Please make sure all fields are valid. You need to fix %1$d %2$s:<br>%3$s', 'godam' ),
				$error_count,
				$error_text,
				implode( '<br>', $errors )
			),
		);

		return $result;
	}

	/**
	 * Map field names from frontend format to original form format.
	 *
	 * @param array  $frontend_fields The frontend field data.
	 * @param object $original_form The original Jetpack form object.
	 * @return array Mapped field names and values.
	 */
	private function map_field_names( $frontend_fields, $original_form ) {
		$mapped_fields = array();

		// Get the original form's field IDs in order.
		$original_field_ids = array_keys( $original_form->fields );

		// Get the frontend field values in order.
		$frontend_values = array_values( $frontend_fields );

		// Map values by order.
		foreach ( $original_field_ids as $i => $field_id ) {
			if ( isset( $frontend_values[ $i ] ) ) {
				$mapped_fields[ $field_id ] = $frontend_values[ $i ];
			}
		}

		return $mapped_fields;
	}

	/**
	 * Load form into memory using the origin post ID.
	 *
	 * @param string $form_id The form ID.
	 * @param string $form_hash The form hash.
	 * @param int    $origin_post_id The origin post ID.
	 * @return bool True if form loaded successfully, false otherwise.
	 */
	private function load_form_into_memory_with_origin( $form_id, $form_hash, $origin_post_id ) {
		// Get the origin post.
		$origin_post = get_post( $origin_post_id );
		if ( ! $origin_post ) {
			return false;
		}

		// Set the global $post to the origin post so Contact_Form constructor works correctly.
		global $post;
		$post = $origin_post; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- necessary for Jetpack form processing.
		setup_postdata( $post );

		try {
			// Parse blocks and find the first Jetpack contact form.
			$blocks     = parse_blocks( $origin_post->post_content );
			$form_block = $this->find_first_jetpack_form_block( $blocks );

			if ( ! $form_block ) {
				return false;
			}

			// Prepare form attributes from the block.
			$form_attributes       = $form_block['attrs'] ?? array();
			$form_attributes['id'] = $origin_post_id; // Use origin post ID.

			// Process inner blocks to get form content.
			$form_content = '';
			if ( ! empty( $form_block['innerBlocks'] ) ) {
				foreach ( $form_block['innerBlocks'] as $inner_block ) {
					$form_content .= render_block( $inner_block );
				}
			}

			// Create the form object.
			$form = new \Automattic\Jetpack\Forms\ContactForm\Contact_Form( $form_attributes, $form_content );
			
			// Generate the correct hash.
			$correct_hash = $form->hash;
			
			// Add to the static forms array.
			Contact_Form::$forms[ $correct_hash ] = $form;
			
			// Store the correct hash globally for later use.
			global $godam_correct_form_hash;
			$godam_correct_form_hash = $correct_hash;
			
			return true;
			
		} catch ( \Exception $e ) {
			return false;
		} finally {
			// Restore the original post data.
			wp_reset_postdata();
		}
	}

	/**
	 * Find the first Jetpack contact form block in the blocks.
	 *
	 * @param array $blocks The blocks to search.
	 * @return array|false The form block or false if not found.
	 */
	private function find_first_jetpack_form_block( $blocks ) {
		return $this->search_for_first_form_block( $blocks );
	}

	/**
	 * Helper method to recursively search for the first form block.
	 *
	 * @param array $blocks The blocks to search.
	 * @return array|false The form block or false if not found.
	 */
	private function search_for_first_form_block( $blocks ) {
		foreach ( $blocks as $block ) {
			// Check if this is a Jetpack contact form block.
			if ( 'jetpack/contact-form' === $block['blockName'] ) {
				return $block;
			}

			// Recursively search in inner blocks.
			if ( ! empty( $block['innerBlocks'] ) ) {
				$result = $this->search_for_first_form_block( $block['innerBlocks'] );
				if ( false !== $result ) {
					return $result;
				}
			}
		}

		return false;
	}

	/**
	 * Invalidate the Jetpack forms cache on post save, delete, or trash.
	 *
	 * @param int $post_id The post ID that was saved, deleted, or trashed.
	 */
	public function invalidate_cache( $post_id ) {
		delete_transient( $this->cache_key );
	}
}
