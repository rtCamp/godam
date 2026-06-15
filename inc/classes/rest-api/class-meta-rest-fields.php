<?php
/**
 * Register REST API endpoints for meta fields.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;


/**
 * Modify Rest fields.
 */
class Meta_Rest_Fields {

	use Singleton;

	/**
	 * Construct method.
	 */
	final protected function __construct() {
		add_action( 'rest_api_init', array( $this, 'add_meta_rest_fields' ), 10, 3 );
	}

	/**
	 * Modify the response to include the 'post-related-posts' field.
	 *
	 * @return void
	 */
	public function add_meta_rest_fields() {
		register_rest_field(
			'attachment',
			'rtgodam_meta',
			array(
				'get_callback'    => function ( $post ) {
					return get_post_meta( $post['id'], 'rtgodam_meta', true );
				},
				'update_callback' => function ( $value, $post ) {
					$value = $this->record_layer_lifetimes( $post->ID, $value );
					return update_post_meta( $post->ID, 'rtgodam_meta', $value );
				},
			)
		);

		register_rest_field(
			'attachment',
			'rtgodam_analytics',
			array(
				'get_callback'    => function ( $post ) {
					return get_post_meta( $post['id'], 'rtgodam_analytics', true );
				},
				'update_callback' => function ( $value, $post ) {
					return update_post_meta( $post->ID, 'rtgodam_analytics', $value );
				},
			)
		);

		register_post_meta(
			'attachment',
			'rtgodam_media_video_thumbnail',
			array(
				'type'          => 'string',
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
			)
		);

		register_post_meta(
			'attachment',
			'rtgodam_transcoding_job_id',
			array(
				'type'          => 'string',
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
			)
		);

		register_post_meta(
			'attachment',
			'rtgodam_hls_transcoded_url',
			array(
				'type'          => 'string',
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
				'get_callback'  => function ( $post ) {
					return rtgodam_get_hls_transcoded_url_from_attachment( $post->ID );
				},
			)
		);
	}

	/**
	 * Record per-sub-hotspot lifetimes (added_at / deleted_at) when a video's
	 * layer config is saved, so the analytics service can credit a sub-hotspot's
	 * inherited `viewed` only for the days it actually existed
	 * (rtCamp/godam-analytics#196).
	 *
	 * Diffs the incoming layers against the previously-saved ones, keyed by the
	 * composite sub-hotspot id the player emits (`parent.id::<hotspot.id>` or
	 * `parent.id::p<productId>`):
	 *  - a sub that appears this save (and was not present before) gets
	 *    added_at=today and a cleared deleted_at (covers re-adds too);
	 *  - a sub that disappears gets deleted_at=today.
	 * A sub that is unchanged is left untouched, and a pre-existing sub never
	 * touched after this ships gets NO entry at all — the service treats a
	 * sub absent from the map as "full history" (open-ended), so historical
	 * content is not retroactively truncated. The map is stored back into
	 * rtgodam_meta['layer_lifetimes'] and survives deletion (a removed sub is
	 * gone from layers[] but its lifetime row must persist). Dates are UTC
	 * Y-m-d to match the service's daily buckets.
	 *
	 * @param int   $post_id Attachment ID.
	 * @param mixed $value   Incoming rtgodam_meta value being saved.
	 * @return mixed The value with an updated `layer_lifetimes` map.
	 */
	private function record_layer_lifetimes( $post_id, $value ) {
		if ( ! is_array( $value ) ) {
			return $value;
		}

		$old_meta = get_post_meta( $post_id, 'rtgodam_meta', true );

		// The authoritative existing map is read from storage, never trusted
		// from the incoming $value (the editor does not manage this field).
		$lifetimes = ( is_array( $old_meta ) && ! empty( $old_meta['layer_lifetimes'] ) && is_array( $old_meta['layer_lifetimes'] ) )
			? $old_meta['layer_lifetimes']
			: array();

		$old_ids = $this->collect_subhotspot_ids( is_array( $old_meta ) ? ( $old_meta['layers'] ?? array() ) : array() );
		$new_ids = $this->collect_subhotspot_ids( $value['layers'] ?? array() );

		$today = gmdate( 'Y-m-d' );

		// Appeared this save (new or re-added) -> start a fresh live window.
		foreach ( $new_ids as $id ) {
			if ( ! in_array( $id, $old_ids, true ) ) {
				$lifetimes[ $id ] = array(
					'added_at'   => $today,
					'deleted_at' => null,
				);
			}
		}

		// Disappeared this save -> stamp deleted_at once, keep the row.
		foreach ( $old_ids as $id ) {
			if ( ! in_array( $id, $new_ids, true ) && empty( $lifetimes[ $id ]['deleted_at'] ) ) {
				if ( empty( $lifetimes[ $id ] ) ) {
					$lifetimes[ $id ] = array( 'added_at' => null );
				}
				$lifetimes[ $id ]['deleted_at'] = $today;
			}
		}

		if ( ! empty( $lifetimes ) ) {
			$value['layer_lifetimes'] = $lifetimes;
		}

		return $value;
	}

	/**
	 * Build the set of composite sub-hotspot ids present in a layers array,
	 * matching the ids the player emits and the analytics service keys on:
	 * `parent.id::<hotspot.id>` for hotspot layers and `parent.id::p<productId>`
	 * for woo layers. Atomic layer types (cta/form/poll) have no sub-hotspots
	 * and are skipped.
	 *
	 * @param mixed $layers Layers array from rtgodam_meta.
	 * @return string[] Unique composite sub-hotspot ids.
	 */
	private function collect_subhotspot_ids( $layers ) {
		$ids = array();
		if ( ! is_array( $layers ) ) {
			return $ids;
		}
		foreach ( $layers as $layer ) {
			if ( empty( $layer['id'] ) || empty( $layer['type'] ) ) {
				continue;
			}
			$parent = (string) $layer['id'];
			if ( 'hotspot' === $layer['type'] && ! empty( $layer['hotspots'] ) && is_array( $layer['hotspots'] ) ) {
				foreach ( $layer['hotspots'] as $hotspot ) {
					if ( ! empty( $hotspot['id'] ) ) {
						$ids[] = $parent . '::' . (string) $hotspot['id'];
					}
				}
			} elseif ( 'woo' === $layer['type'] && ! empty( $layer['productHotspots'] ) && is_array( $layer['productHotspots'] ) ) {
				foreach ( $layer['productHotspots'] as $product ) {
					if ( ! empty( $product['productId'] ) ) {
						$ids[] = $parent . '::p' . (int) $product['productId'];
					}
				}
			}
		}
		return array_values( array_unique( $ids ) );
	}
}
