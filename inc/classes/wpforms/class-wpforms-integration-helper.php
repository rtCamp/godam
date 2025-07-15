<?php
/**
 * Helper functions related to WPForms Integration.
 *
 * @since n.e.x.t
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\WPForms;

defined( 'ABSPATH' ) || exit;

/**
 * Class containing helper functions related to WPForms Integration.
 *
 * @since n.e.x.t
 */
class WPForms_Integration_Helper {

	/**
	 * Save multiple meta values to entry.
	 *
	 * @since n.e.x.t
	 *
	 * @param integer $form_id Form ID.
	 * @param integer $entry_id Entry ID.
	 * @param array   $meta_values Meta values.
	 *
	 * @return boolean
	 */
	public static function save_meta_values_to_entry( $form_id, $entry_id, $meta_values ) {
		$entry_meta_obj = wpforms()->entry_meta;

		if ( ! $entry_meta_obj ) {
			return false;
		}

		foreach ( $meta_values as $meta_value ) {
			$meta_value = wp_parse_args(
				$meta_value,
				array(
					'type' => '',
					'data' => '',
				)
			);

			if ( empty( $meta_value['type'] ) || empty( $meta_value['data'] ) ) {
				continue;
			}

			$entry_meta_obj->add(
				array(
					'entry_id' => $entry_id,
					'form_id'  => $form_id,
					'type'     => $meta_value['type'],
					'data'     => $meta_value['data'],
				)
			);
		}

		return true;
	}

	/**
	 * Return transcode status stored in the entry's meta.
	 *
	 * @since n.e.x.t
	 *
	 * @param integer $form_id Form ID.
	 * @param integer $entry_id Entry ID.
	 * @param integer $field_id Field ID.
	 * @param integer $index Files index.
	 *
	 * @return null|string
	 */
	public static function get_transcoded_status( $form_id, $entry_id, $field_id, $index = 0 ) {
		$entry_meta_obj = wpforms()->entry_meta;

		if ( ! $entry_meta_obj ) {
			return null;
		}

		$key = 'rtgodam_transcoded_status_' . $field_id . '_' . $index;

		$meta_value = $entry_meta_obj->get_meta(
			array(
				'entry_id' => $entry_id,
				'form_id'  => $form_id,
				'type'     => $key,
			)
		);

		if ( ! $meta_value ) {
			return null;
		}

		$status = $meta_value[0]->data;

		return function_exists( 'mb_strtolower' ) ? mb_strtolower( $status ) : strtolower( $status );
	}

	/**
	 * Return transcode url stored in the entry's meta.
	 *
	 * @since n.e.x.t
	 *
	 * @param integer $form_id Form ID.
	 * @param integer $entry_id Entry ID.
	 * @param integer $field_id Field ID.
	 * @param integer $index Files index.
	 *
	 * @return null|string
	 */
	public static function get_transcoded_url( $form_id, $entry_id, $field_id, $index = 0 ) {
		$entry_meta_obj = wpforms()->entry_meta;

		if ( ! $entry_meta_obj ) {
			return null;
		}

		$key = 'rtgodam_transcoded_url_' . $field_id . '_' . $index;

		$meta_value = $entry_meta_obj->get_meta(
			array(
				'entry_id' => $entry_id,
				'form_id'  => $form_id,
				'type'     => $key,
			)
		);

		if ( ! $meta_value ) {
			return null;
		}

		return $meta_value[0]->data;
	}

	/**
	 * Return transcode url stored in the entry's meta.
	 *
	 * @since n.e.x.t
	 *
	 * @param integer $form_id Form ID.
	 * @param integer $entry_id Entry ID.
	 * @param integer $field_id Field ID.
	 * @param integer $index Files index.
	 *
	 * @return null|string
	 */
	public static function get_hls_transcoded_url( $form_id, $entry_id, $field_id, $index = 0 ) {
		$entry_meta_obj = wpforms()->entry_meta;

		if ( ! $entry_meta_obj ) {
			return null;
		}

		$key = 'rtgodam_hls_transcoded_url_' . $field_id . '_' . $index;

		$meta_value = $entry_meta_obj->get_meta(
			array(
				'entry_id' => $entry_id,
				'form_id'  => $form_id,
				'type'     => $key,
			)
		);

		if ( ! $meta_value ) {
			return null;
		}

		return $meta_value[0]->data;
	}

	/**
	 * Return transcode thumbnails stored in the entry's meta.
	 *
	 * @since n.e.x.t
	 *
	 * @param integer $form_id Form ID.
	 * @param integer $entry_id Entry ID.
	 * @param integer $field_id Field ID.
	 * @param integer $index Files index.
	 *
	 * @return null|string[]
	 */
	public static function get_hls_transcoded_thumbnails( $form_id, $entry_id, $field_id, $index = 0 ) {
		$entry_meta_obj = wpforms()->entry_meta;

		if ( ! $entry_meta_obj ) {
			return null;
		}

		$key = 'rtgodam_hls_transcoded_thumbnails_' . $field_id . '_' . $index;

		$meta_value = $entry_meta_obj->get_meta(
			array(
				'entry_id' => $entry_id,
				'form_id'  => $form_id,
				'type'     => $key,
			)
		);

		if ( ! $meta_value ) {
			return null;
		}

		return json_decode( $meta_value[0]->data );
	}
}
