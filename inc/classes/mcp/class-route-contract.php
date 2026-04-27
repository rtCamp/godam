<?php
/**
 * MCP route contract registry.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\MCP;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class Route_Contract.
 */
class Route_Contract {

	use Singleton;

	/**
	 * Supported MCP-facing route contract.
	 *
	 * @var array<string, array<string, mixed>>
	 */
	private $routes = array();

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->routes = $this->build_routes();
	}

	/**
	 * Get the current route contract.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public function get_routes() {
		/**
		 * Filters the internal MCP route contract.
		 *
		 * @param array<string, array<string, mixed>> $routes Route definitions.
		 */
		return apply_filters( 'rtgodam_mcp_route_contract', $this->routes );
	}

	/**
	 * Build the initial MCP route contract.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	private function build_routes() {
		return array(
			'dashboard_metrics'                 => array(
				'path'       => '/wp-json/godam/v1/analytics/dashboard-metrics',
				'ability'    => 'godam/get-dashboard-metrics',
				'method'     => 'GET',
				'capability' => 'read',
				'readonly'   => true,
				'phase'      => 'phase-1',
			),
			'dashboard_history'                 => array(
				'path'       => '/wp-json/godam/v1/analytics/dashboard-history',
				'ability'    => 'godam/get-dashboard-history',
				'method'     => 'GET',
				'capability' => 'read',
				'readonly'   => true,
				'phase'      => 'phase-1',
			),
			'top_videos'                        => array(
				'path'       => '/wp-json/godam/v1/analytics/top-videos',
				'ability'    => 'godam/get-top-videos',
				'method'     => 'GET',
				'capability' => 'read',
				'readonly'   => true,
				'phase'      => 'phase-1',
			),
			'video_analytics_summary'           => array(
				'path'       => '/wp-json/godam/v1/analytics/fetch',
				'ability'    => 'godam/get-video-analytics-summary',
				'method'     => 'GET',
				'capability' => 'read',
				'readonly'   => true,
				'phase'      => 'phase-1',
			),
			'analytics_history'                 => array(
				'path'       => '/wp-json/godam/v1/analytics/history',
				'ability'    => 'godam/get-video-analytics-history',
				'method'     => 'GET',
				'capability' => 'read',
				'readonly'   => true,
				'phase'      => 'phase-1',
			),
			'attachment_details'                => array(
				'path'       => '/wp-json/godam/v1/media-library/attachment-by-id/{attachmentId}',
				'ability'    => 'godam/get-attachment-details',
				'method'     => 'GET',
				'capability' => 'upload_files',
				'readonly'   => true,
				'phase'      => 'phase-1',
			),
			'update_media_metadata'             => array(
				'path'       => '/wp-json/wp/v2/media/{attachmentId}',
				'ability'    => 'godam/update-media-metadata',
				'method'     => 'POST',
				'capability' => 'upload_files',
				'readonly'   => false,
				'phase'      => 'phase-3',
			),
			'media_folders'                     => array(
				'path'       => '/wp-json/godam/v1/media-library/media-folders',
				'ability'    => 'godam/get-media-folders',
				'method'     => 'GET',
				'capability' => 'upload_files',
				'readonly'   => true,
				'phase'      => 'phase-1',
			),
			'create_media_folder'               => array(
				'path'       => '/wp-json/wp/v2/media-folder',
				'ability'    => 'godam/create-media-folder',
				'method'     => 'POST',
				'capability' => 'upload_files',
				'readonly'   => false,
				'phase'      => 'phase-3',
			),
			'rename_media_folder'               => array(
				'path'       => '/wp-json/wp/v2/media-folder/{folderId}',
				'ability'    => 'godam/rename-media-folder',
				'method'     => 'POST',
				'capability' => 'upload_files',
				'readonly'   => false,
				'phase'      => 'phase-3',
			),
			'delete_media_folders'              => array(
				'path'       => '/wp-json/godam/v1/media-library/bulk-delete-folders',
				'ability'    => 'godam/delete-media-folders',
				'method'     => 'DELETE',
				'capability' => 'upload_files',
				'readonly'   => false,
				'phase'      => 'phase-3',
			),
			'set_media_folders_bookmark_status' => array(
				'path'       => '/wp-json/godam/v1/media-library/bulk-bookmark-folders',
				'ability'    => 'godam/set-media-folders-bookmark-status',
				'method'     => 'POST',
				'capability' => 'upload_files',
				'readonly'   => false,
				'phase'      => 'phase-3',
			),
			'set_media_folders_lock_status'     => array(
				'path'       => '/wp-json/godam/v1/media-library/bulk-lock-folders',
				'ability'    => 'godam/set-media-folders-lock-status',
				'method'     => 'POST',
				'capability' => 'upload_files',
				'readonly'   => false,
				'phase'      => 'phase-3',
			),
			'assign_folder'                     => array(
				'path'       => '/wp-json/godam/v1/media-library/assign-folder',
				'ability'    => 'godam/assign-media-to-folder',
				'method'     => 'POST',
				'capability' => 'edit_posts',
				'readonly'   => false,
				'phase'      => 'phase-3',
			),
			'set_video_thumbnail'               => array(
				'path'       => '/wp-json/godam/v1/media-library/set-video-thumbnail',
				'ability'    => 'godam/set-video-thumbnail',
				'method'     => 'POST',
				'capability' => 'edit_posts',
				'readonly'   => false,
				'phase'      => 'phase-3',
			),
			'upload_custom_thumbnail'           => array(
				'path'       => '/wp-json/godam/v1/media-library/upload-custom-video-thumbnail',
				'ability'    => 'godam/upload-custom-video-thumbnail',
				'method'     => 'POST',
				'capability' => 'upload_files',
				'readonly'   => false,
				'phase'      => 'phase-3',
			),
			'delete_custom_thumbnail'           => array(
				'path'       => '/wp-json/godam/v1/media-library/delete-custom-video-thumbnail',
				'ability'    => 'godam/delete-custom-video-thumbnail',
				'method'     => 'POST',
				'capability' => 'edit_posts',
				'readonly'   => false,
				'phase'      => 'phase-3',
			),
			'transcoding_status'                => array(
				'path'       => '/wp-json/godam/v1/transcoding/transcoding-status/',
				'ability'    => 'godam/get-transcoding-status',
				'method'     => 'GET',
				'capability' => 'read',
				'readonly'   => true,
				'phase'      => 'phase-1',
			),
			'retranscode_media'                 => array(
				'path'       => '/wp-json/godam/v1/transcoding/retranscode/',
				'ability'    => 'godam/retranscode-media',
				'method'     => 'POST',
				'capability' => 'edit_others_posts',
				'readonly'   => false,
				'phase'      => 'phase-3',
			),
		);
	}
}
