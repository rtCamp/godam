<?php
/**
 * Class to handle Media Folders.
 *
 * @package transcoder
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Media_Library
 */
class Media_Library_Ajax {

	use Singleton;

	/**
	 * Construct method.
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
		add_filter( 'ajax_query_attachments_args', array( $this, 'filter_media_library_by_taxonomy' ) );
		add_filter( 'ajax_query_attachments_args', array( $this, 'godam_media_library_ajax' ) );
		add_action( 'pre_get_posts', array( $this, 'pre_get_post_filter' ) );

		add_action( 'restrict_manage_posts', array( $this, 'restrict_manage_media_filter' ) );
		add_action( 'add_attachment', array( $this, 'add_media_library_taxonomy_on_media_upload' ), 10, 1 );
		add_filter( 'wp_prepare_attachment_for_js', array( $this, 'add_media_transcoding_status_js' ), 10, 2 );

		add_action( 'pre_delete_term', array( $this, 'delete_child_media_folder' ), 10, 2 );
		add_action( 'delete_attachment', array( $this, 'handle_media_deletion' ), 10, 1 );
	}

	/**
	 * Short-circuit the media library AJAX request if the mime type is 'godam'.
	 *
	 * @param array $query_args Query arguments.
	 * @return array
	 */
	public function godam_media_library_ajax( $query_args ) {

		$api_key = get_site_option( 'rtgodam-api-key', '' );

		if ( empty( $api_key ) ) {
			return $query_args;
		}

		if ( isset( $query_args['post_mime_type'] ) && is_array( $query_args['post_mime_type'] ) ) {
			
			$post_mime_type = $query_args['post_mime_type'][0];
			$mime_type      = '';
			if ( false === strpos( $post_mime_type, 'godam/' ) ) {
				return $query_args;
			} else {
				// mime_type is godam/{mime_type}.
				$mime_type = str_replace( 'godam/', '', $post_mime_type );
				$mime_type = explode( '-', $mime_type );
				$mime_type = $mime_type[0];
				if ( 'all' === $mime_type ) {
					$mime_type = '';
				}
			}

			$api_url = RTGODAM_API_BASE . '/api/method/godam_core.api.file.get_list_of_files_with_api_key';


			$order_by = 'creation asc';
			if ( isset( $query_args['order'] ) && 'DESC' === $query_args['order'] ) {
				$order_by = 'creation desc';
			}

			$request_args = array(
				'api_key'  => $api_key,
				'order_by' => $order_by,
			);

			if ( ! empty( $mime_type ) ) {
				if ( 'video' === $mime_type ) {
					$request_args['job_type'] = 'stream';
				} else {
					$request_args['job_type'] = $mime_type;
				}
			}

			if ( isset( $query_args['s'] ) && ! empty( $query_args['s'] ) ) {
				$request_args['search'] = $query_args['s'];
			}

			if ( isset( $query_args['posts_per_page'] ) && ! empty( $query_args['paged'] ) ) {
				$request_args['page_size'] = intval( $query_args['posts_per_page'] );
				$request_args['page']      = intval( $query_args['paged'] );
			}

			$api_url = add_query_arg(
				$request_args,
				$api_url
			);

			$response = wp_remote_get(
				$api_url,
				array(
					'headers' => array(
						'Content-Type' => 'application/json',
					),
				) 
			);

			if ( is_wp_error( $response ) ) {
				return $query_args;
			}

			$body = json_decode( wp_remote_retrieve_body( $response ) );

			$response = $body->message;

			foreach ( $response as $key => $item ) {
				$response[ $key ] = $this->prepare_godam_media_item( $item );
			}

			wp_send_json_success( $response );

		} else {
			return $query_args;
		}
	}

	/**
	 * Prepare a single Godam media item to match WordPress media format.
	 *
	 * @param array $item The media item data from the API.
	 * @return array
	 */
	public function prepare_godam_media_item( $item ) {
		// Ensure $item is an array.
		$item = (array) $item; 

		if ( empty( $item['name'] ) || empty( $item['file_origin'] ) ) {
			return array();
		}

		$result = array(
			'id'                    => $item['name'],
			'title'                 => pathinfo( $item['orignal_file_name'], PATHINFO_FILENAME ) ?? $item['name'],
			'filename'              => $item['orignal_file_name'] ?? $item['name'],
			'url'                   => 'image' === $item['job_type'] ? $item['file_origin'] : ( $item['transcoded_file_path'] ?? $item['file_origin'] ),
			'mime'                  => 'application/dash+xml' ?? '',
			'type'                  => $item['job_type'] ?? '',
			'subtype'               => explode( '/', $item['mime_type'] )[1] ?? 'jpg',
			'status'                => $item['status'],
			'date'                  => strtotime( $item['creation'] ) * 1000,
			'modified'              => strtotime( $item['modified'] ) * 1000,
			'filesizeInBytes'       => $item['file_size'],
			'filesizeHumanReadable' => size_format( $item['file_size'] ),
			'owner'                 => $item['owner'] ?? '',
			'label'                 => $item['file_label'] ?? '',
		);

		if ( 'stream' === $item['job_type'] ) {
			$result['icon'] = $item['thumbnail_url'] ?? '';
			$result['type'] = 'video';
		}

		return $result;
	}

	/**
	 * Add the media library taxonomy to the uploaded media.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return void
	 */
	public function add_media_library_taxonomy_on_media_upload( $attachment_id ) {

		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- Hooking into default WP hooks.

		if ( ! isset( $_REQUEST['media-folder'] ) || empty( $_REQUEST['media-folder'] ) || $_REQUEST['media-folder'] <= 0 ) {
			return;
		}

		// Get the media folder.
		$media_folder = intval( $_REQUEST['media-folder'] ); // Ensure it's an integer.

		// Check if the term exists.
		$term = get_term( $media_folder, 'media-folder' );

		if ( is_wp_error( $term ) || ! $term || $term->term_id !== $media_folder ) {
			return;
		}

		// Assign the existing term.
		wp_set_object_terms( $attachment_id, (int) $media_folder, 'media-folder' );

		// phpcs:enable WordPress.Security.NonceVerification.Recommended
	}

	/**
	 * Recursively delete child media folders.
	 *
	 * @param int    $term     Term ID.
	 * @param string $taxonomy Taxonomy.
	 *
	 * @return void
	 */
	public function delete_child_media_folder( $term, $taxonomy ) {
		if ( 'media-folder' !== $taxonomy ) {
			return;
		}

		$children = get_terms(
			array(
				'taxonomy'   => $taxonomy,
				'parent'     => $term,
				'hide_empty' => false,
			)
		);

		/**
		 * As we use the wp_delete_term and hook get's called again,
		 * hence we can safely delete that and child of child will also be deleted.
		 */
		foreach ( $children as $child ) {
			wp_delete_term( $child->term_id, $taxonomy );
		}
	}

	/**
	 * Add transcoding URL to the media JS Object.
	 *
	 * @param array   $response Attachment response.
	 * @param WP_Post $attachment Attachment object.
	 * @return array $response Attachment response.
	 */
	public function add_media_transcoding_status_js( $response, $attachment ) {
		// Check if attachment type is video.
		if ( 'video' !== substr( $attachment->post_mime_type, 0, 5 ) ) {
			return $response;
		}

		$transcoded_url = get_post_meta( $attachment->ID, 'rtgodam_transcoded_url', true );

		if ( ! empty( $transcoded_url ) ) {
			$response['transcoded_url'] = $transcoded_url;
		} else {
			$response['transcoded_url'] = false;
		}

		return $response;
	}

	/**
	 * Filter the media library arguments to include folders.
	 *
	 * @param array $query_args Query arguments.
	 *
	 * @return array
	 */
	public function filter_media_library_by_taxonomy( $query_args ) {

		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- Hooking into default WP hooks.

		if ( isset( $_REQUEST['query']['media-folder'] ) ) {
			$media_folder_id = sanitize_text_field( wp_unslash( $_REQUEST['query']['media-folder'] ) );

			if ( 'uncategorized' === $media_folder_id ) {
				$media_folder_id = 0;
			} elseif ( 'all' === $media_folder_id ) {
				$media_folder_id = -1;
			} else {
				$media_folder_id = intval( $media_folder_id );
			}

			// Handle uncategorized folder (media-folder ID = 0).
			if ( 0 === $media_folder_id ) {
				$uncategorized_ids = get_terms(
					array(
						'taxonomy'   => 'media-folder',
						'fields'     => 'ids',
						'hide_empty' => false,
					)
				);

				$query_args['tax_query'] = array( // phpcs:ignore -- tax_query is required here to filter by taxonomy.
					array(
						'taxonomy'         => 'media-folder',
						'field'            => 'term_id',
						'terms'            => $uncategorized_ids,
						'operator'         => 'NOT IN',
						'include_children' => false,
					),
				);
			} elseif ( -1 !== $media_folder_id && ! empty( $media_folder_id ) ) {
				$query_args['tax_query'] = array( // phpcs:ignore -- tax_query is required here to filter by taxonomy.
					array(
						'taxonomy'         => 'media-folder',
						'field'            => 'term_id',
						'terms'            => $media_folder_id,
						'include_children' => false,
					),
				);
			}

			// Unset the 'media-folder' query arg regardless of the case.
			unset( $query_args['media-folder'] );
		}

		if ( isset( $_REQUEST['query']['date_query'] ) && is_array( $_REQUEST['query']['date_query'] ) ) {
			$query_args['date_query'] = $this->sanitize_date_query( $_REQUEST['query']['date_query'] ); // phpcs:ignore -- date_query is getting sanitized by custom function.
		}

		return $query_args;

		// phpcs:enable WordPress.Security.NonceVerification.Recommended
	}

	/**
	 * Filter the media library by folder.
	 *
	 * @param Object $query Query object.
	 * @return void
	 */
	public function pre_get_post_filter( $query ) {

		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- Hooking into default WP hooks.

		if ( is_admin() && $query->is_main_query() && $query->get( 'post_type' ) === 'attachment' ) {
			$media_folder = isset( $_GET['media-folder'] ) ? sanitize_text_field( wp_unslash( $_GET['media-folder'] ) ) : null;

			if ( $media_folder && 'uncategorized' === $media_folder ) {
				$query->set(
					'tax_query',
					array(
						array(
							'taxonomy' => 'media-folder',
							'field'    => 'term_id',
							'operator' => 'NOT IN',
							'terms'    => get_terms(
								array(
									'taxonomy'   => 'media-folder',
									'fields'     => 'ids',
									'hide_empty' => false,
								)
							),
						),
					)
				);
			} elseif ( $media_folder && 'all' !== $media_folder ) {
				$query->set( // phpcs:ignore
					'tax_query',
					array(
						array(
							'taxonomy'         => 'media-folder',
							'field'            => 'term_id',
							'terms'            => (int) $media_folder,
							'include_children' => false,
						),
					)
				);
			}

			unset( $query->query_vars['media-folder'] );

			if ( isset( $_GET['date-start'] ) && isset( $_GET['date-end'] ) ) {
				$query->set(
					'date_query',
					array(
						'inclusive' => true,
						'after'     => sanitize_text_field( wp_unslash( $_GET['date-start'] ) ),
						'before'    => sanitize_text_field( wp_unslash( $_GET['date-end'] ) ),
					)
				);
			}
		}

		// phpcs:enable WordPress.Security.NonceVerification.Recommended
	}

	/**
	 * Add a dropdown filter to the media library.
	 *
	 * @return void
	 */
	public function restrict_manage_media_filter() {
		$screen = get_current_screen();

		if ( 'upload' === $screen->id ) {
			// Get the current folder filter value from the URL.
			$media_folder = isset( $_GET['media-folder'] ) ? sanitize_text_field( wp_unslash( $_GET['media-folder'] ) ) : 'all'; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Just echoing the value without any usage.

			// Get all terms from the 'media-folder' taxonomy.
			$terms = get_terms(
				array(
					'taxonomy'   => 'media-folder',
					'hide_empty' => false,
				)
			);

			// Define default options.
			$folders = array(
				(object) array(
					'id'   => 'uncategorized',
					'name' => __( 'Uncategorized', 'godam' ),
				),
				(object) array(
					'id'   => 'all',
					'name' => __( 'All collections', 'godam' ),
				),
			);

			// Add taxonomy terms to the folder list.
			foreach ( $terms as $term ) {
				$folders[] = (object) array(
					'id'   => $term->term_id,
					'name' => $term->name,
				);
			}

			// Render the dropdown.
			echo '<select id="media-folder-filter" name="media-folder" class="attachment-filters">';
			foreach ( $folders as $folder ) {
				printf(
					'<option value="%1$s" %3$s>%2$s</option>',
					esc_attr( $folder->id ),
					esc_html( $folder->name ),
					selected( $media_folder, $folder->id, false )
				);
			}
			echo '</select>';

			// Render the date range filter.
			echo '<input id="media-date-range-filter" />';
			echo '<input id="media-date-range-filter-start" name="date-start" />';
			echo '<input id="media-date-range-filter-end" name="date-end" />';
		}
	}

	/**
	 * Sanitize the date query.
	 *
	 * Filter the date_query to only allow specific date formats and the valid relation.
	 *
	 * @param array $date_query Date query.
	 *
	 * @return array $date_query sanitized date query.
	 */
	private function sanitize_date_query( $date_query ) {
		if ( ! is_array( $date_query ) ) {
			return array();
		}

		$allowed_keys    = array( 'inclusive', 'after', 'before' );
		$sanitized_query = array();

		foreach ( $allowed_keys as $key ) {
			if ( isset( $date_query[ $key ] ) ) {
				switch ( $key ) {
					case 'inclusive':
						$sanitized_query['inclusive'] = filter_var( $date_query['inclusive'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE );
						break;
					case 'after':
					case 'before':
						$sanitized_query[ $key ] = sanitize_text_field( $date_query[ $key ] );
						if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $sanitized_query[ $key ] ) ) {
							unset( $sanitized_query[ $key ] );
						}
						break;
				}
			}
		}

		return $sanitized_query;
	}

	/**
	 * Handle media deletion and notify the external API.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return void
	 */
	public function handle_media_deletion( $attachment_id ) {
		$job_id        = get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );
		$account_token = get_site_option( 'rtgodam-account-token', '' );
		$api_key       = get_site_option( 'rtgodam-api-key', '' );

		// Ensure all required data is available.
		if ( empty( $job_id ) || empty( $account_token ) || empty( $api_key ) ) {
			return;
		}

		// API URL using RTGODAM_API_BASE.
		$api_url = RTGODAM_API_BASE . '/api/method/godam_core.api.mutate.delete_attachment';

		// Request params.
		$params = array(
			'job_id'        => $job_id,
			'api_key'       => $api_key,
			'account_token' => $account_token,
		);

		// Send POST request.
		wp_remote_post(
			$api_url,
			array(
				'body'    => wp_json_encode( $params ),
				'headers' => array( 'Content-Type' => 'application/json' ),
			)
		);
	}
}
