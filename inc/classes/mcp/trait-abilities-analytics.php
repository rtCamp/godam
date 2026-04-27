<?php
/**
 * MCP abilities partial: Abilities_Analytics.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\MCP;

use RTGODAM\Inc\Media_Library\Media_Folder_Utils;
use RTGODAM\Inc\REST_API\Analytics;
use RTGODAM\Inc\REST_API\Media_Library;
use RTGODAM\Inc\REST_API\Site;
use RTGODAM\Inc\REST_API\Transcoding;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined( 'ABSPATH' ) || exit;

/**
 * Abilities_Analytics trait.
 */
trait Abilities_Analytics {

	/**
	 * Extract an average engagement percentage from analytics payloads.
	 *
	 * @param mixed $analytics Analytics payload.
	 * @return float
	 */
	private function get_average_engagement_value( $analytics ) {
		if ( is_string( $analytics ) ) {
			$decoded = json_decode( $analytics, true );
			if ( is_array( $decoded ) ) {
				$analytics = $decoded;
			} elseif ( is_numeric( trim( $analytics ) ) ) {
				$analytics = (float) $analytics;
			}
		}

		$extract = static function ( $node ) use ( &$extract ) {
			$keys = array( 'average_engagement', 'avg_engagement', 'averageEngagement', 'avgEngagement' );
			if ( is_array( $node ) ) {
				foreach ( $keys as $key ) {
					if ( isset( $node[ $key ] ) && is_numeric( $node[ $key ] ) ) {
						return (float) $node[ $key ];
					}
				}

				foreach ( $node as $value ) {
					$result = $extract( $value );
					if ( null !== $result ) {
						return $result;
					}
				}
			}

			if ( is_numeric( $node ) ) {
				return (float) $node;
			}

			return null;
		};

		$value = $extract( $analytics );
		if ( null === $value ) {
			return 0.0;
		}

		if ( $value >= 0 && $value <= 1 ) {
			$value *= 100;
		}

		$value = min( max( $value, 0 ), 100 );
		return (float) number_format( $value, 2, '.', '' );
	}

	/**
	 * Return currently registered GoDAM ability ids.
	 *
	 * @return array<int, string>
	 */
	private function get_registered_ability_ids() {
		return array(
			'godam/get-dashboard-metrics',
			'godam/get-dashboard-history',
			'godam/get-top-videos',
			'godam/get-video-analytics-summary',
			'godam/get-video-analytics-history',
			'godam/get-attachment-details',
			'godam/update-media-metadata',
			'godam/get-media-folders',
			'godam/create-media-folder',
			'godam/rename-media-folder',
			'godam/delete-media-folders',
			'godam/set-media-folders-bookmark-status',
			'godam/set-media-folders-lock-status',
			'godam/assign-media-to-folder',
			'godam/set-video-thumbnail',
			'godam/upload-custom-video-thumbnail',
			'godam/delete-custom-video-thumbnail',
			'godam/get-transcoding-status',
			'godam/retranscode-media',
			'godam/get-site-capabilities',
			'godam/search-entities',
			'godam/get-transcoded-video-urls',
			'godam/get-rising-trend-videos',
			'godam/get-media-inventory',
			'godam/get-transcoding-overview',
			'godam/get-upload-or-transcode-status',
			'godam/upload-video-to-media',
			'godam/upload-and-track-transcode',
			'godam/get-mcp-contract',
		);
	}
}
