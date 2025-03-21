<?php
/**
 * Class to handle Media Folders.
 *
 * @package transcoder
 */

namespace Transcoder\Inc;

defined( 'ABSPATH' ) || exit;

use Transcoder\Inc\Traits\Singleton;

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
		add_action( 'pre_get_posts', array( $this, 'pre_get_post_filter' ) );

		add_action( 'restrict_manage_posts', array( $this, 'restrict_manage_media_filter' ) );
		add_action( 'add_attachment', array( $this, 'add_media_library_taxonomy_on_media_upload' ), 10, 1 );
		add_filter( 'wp_prepare_attachment_for_js', array( $this, 'add_media_transcoding_status_js' ), 10, 2 );

		add_action( 'pre_delete_term', array( $this, 'delete_child_media_folder' ), 10, 2 );
		add_action( 'delete_attachment', array( $this, 'handle_media_deletion' ), 10, 1 );
	}

	/**
	 * Add the media library taxonomy to the uploaded media.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return void
	 */
	public function add_media_library_taxonomy_on_media_upload( $attachment_id ) {
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

		$transcoded_url = get_post_meta( $attachment->ID, '_rt_transcoded_url', true );

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

		if ( isset( $_REQUEST['query']['media-folder'] ) ) {
			$media_folder_id = sanitize_text_field( $_REQUEST['query']['media-folder'] );

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
			$query_args['date_query'] = $this->sanitize_date( $_REQUEST['query']['date_query'] ); // phpcs:ignore -- date_query is getting sanitized by custom function.
		}

		return $query_args;
	}

	/**
	 * Filter the media library by folder.
	 *
	 * @param Object $query Query object.
	 * @return void
	 */
	public function pre_get_post_filter( $query ) {
		if ( is_admin() && $query->is_main_query() && $query->get( 'post_type' ) === 'attachment' ) {
			$media_folder = isset( $_GET['media-folder'] ) ? sanitize_text_field( $_GET['media-folder'] ) : null;

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
						'relation' => 'AND',
						array(
							'after' => sanitize_text_field( $_GET['date-start'] ),
						),
						array(
							'before' => sanitize_text_field( $_GET['date-end'] ),
						),
					)
				);
			}
		}
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
			$media_folder = isset( $_GET['media-folder'] ) ? sanitize_text_field( $_GET['media-folder'] ) : 'all';

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
	private function sanitize_date( $date_query ) {
		return array_filter(
			array_map(
				function ( $item ) {
					if ( is_array( $item ) ) {
						$sanitized_item = array();
						foreach ( $item as $key => $value ) {
							if ( 'after' === $key || 'before' === $key ) {
								// Validate date format (YYYY-MM-DD).
								if ( preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ) {
									$sanitized_item[ $key ] = $value;
								}
							} else {
								// Sanitize any other keys.
								$sanitized_item[ $key ] = sanitize_text_field( $value );
							}
						}
						return $sanitized_item;
					} else {
						$valid_relations = array( 'AND', 'OR' );
						return in_array( $item, $valid_relations, true ) ? sanitize_text_field( $item ) : null;
					}
					return null;
				},
				$date_query
			)
		);
	}

	/**
	 * Handle media deletion and notify the external API.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return void
	 */
	public function handle_media_deletion( $attachment_id ) {
		$job_id        = get_post_meta( $attachment_id, '_rt_transcoding_job_id', true );
		$account_token = get_site_option( 'rt-transcoding-account-token', '' );
		$license_key   = get_site_option( 'rt-transcoding-api-key', '' );

		// Ensure all required data is available.
		if ( empty( $job_id ) || empty( $account_token ) || empty( $license_key ) ) {
			return;
		}

		// API URL using GODAM_API_BASE.
		$api_url = GODAM_API_BASE . '/api/method/godam_core.api.mutate.delete_attachment';

		// Request params.
		$params = array(
			'job_id'        => $job_id,
			'license_key'   => $license_key,
			'account_token' => $account_token,
		);

		// Send POST request.
		wp_remote_post(
			$api_url,
			array(
				'body'    => wp_json_encode( $params ),
				'headers' => array( 'Content-Type' => 'application/json' ),
				'timeout' => 10,
			)
		);
	}
}
