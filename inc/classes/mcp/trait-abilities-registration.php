<?php
/**
 * MCP abilities partial: Abilities_Registration.
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
 * Abilities_Registration trait.
 */
trait Abilities_Registration {

	/**
	 * Register the GoDAM MCP ability category.
	 *
	 * @return void
	 */
	public function register_category() {
		if ( ! function_exists( 'wp_register_ability_category' ) ) {
			return;
		}

		wp_register_ability_category(
			'godam-mcp',
			array(
				'label'       => __( 'GoDAM MCP', 'godam' ),
				'description' => __( 'GoDAM MCP read and status abilities.', 'godam' ),
			)
		);
	}

	/**
	 * Register an ability with metadata required by the MCP Adapter default server.
	 *
	 * @param string               $name Ability name.
	 * @param array<string, mixed> $args Ability registration arguments.
	 * @return mixed
	 */
	private function register_ability_for_mcp( $name, array $args ) {
		if ( empty( $args['meta'] ) || ! is_array( $args['meta'] ) ) {
			$args['meta'] = array();
		}

		if ( empty( $args['meta']['mcp'] ) || ! is_array( $args['meta']['mcp'] ) ) {
			$args['meta']['mcp'] = array();
		}

		$args['meta']['mcp']['public'] = true;

		return wp_register_ability( $name, $args );
	}

	/**
	 * Register MCP discovery abilities.
	 *
	 * @return void
	 */
	public function register_abilities() {
		if ( ! function_exists( 'wp_register_ability' ) ) {
			return;
		}

		$this->register_dashboard_metrics_ability();
		$this->register_dashboard_history_ability();
		$this->register_top_videos_ability();
		$this->register_video_analytics_summary_ability();
		$this->register_video_analytics_history_ability();
		$this->register_attachment_details_ability();
		$this->register_update_media_metadata_ability();
		$this->register_media_folders_ability();
		$this->register_create_media_folder_ability();
		$this->register_rename_media_folder_ability();
		$this->register_delete_media_folders_ability();
		$this->register_set_media_folders_bookmark_status_ability();
		$this->register_set_media_folders_lock_status_ability();
		$this->register_assign_media_to_folder_ability();
		$this->register_set_video_thumbnail_ability();
		$this->register_upload_custom_video_thumbnail_ability();
		$this->register_delete_custom_video_thumbnail_ability();
		$this->register_transcoding_status_ability();
		$this->register_retranscode_media_ability();
		$this->register_site_capabilities_ability();
		$this->register_search_entities_ability();
		$this->register_transcoded_video_urls_ability();
		$this->register_rising_trend_videos_ability();
		$this->register_media_inventory_bridge_ability();
		$this->register_transcoding_overview_bridge_ability();
		$this->register_upload_or_transcode_status_bridge_ability();
		$this->register_upload_video_to_media_bridge_ability();
		$this->register_upload_and_track_transcode_bridge_ability();

		$this->register_ability_for_mcp(
			'godam/get-mcp-contract',
			array(
				'label'               => __( 'Get GoDAM MCP Contract', 'godam' ),
				'description'         => __( 'Returns the GoDAM MCP route contract currently exposed by the plugin.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'routes' => array(
							'type'                 => 'object',
							'additionalProperties' => array(
								'type'       => 'object',
								'properties' => array(
									'path'       => array(
										'type' => 'string',
									),
									'ability'    => array(
										'type' => array( 'string', 'null' ),
									),
									'method'     => array(
										'type' => 'string',
									),
									'capability' => array(
										'type' => 'string',
									),
									'readonly'   => array(
										'type' => 'boolean',
									),
									'phase'      => array(
										'type' => 'string',
									),
								),
								'required'   => array( 'path', 'ability', 'method', 'capability', 'readonly', 'phase' ),
							),
						),
					),
					'required'   => array( 'routes' ),
				),
				'permission_callback' => array( $this, 'can_read_contract' ),
				'execute_callback'    => array( $this, 'get_contract' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register attachment details ability.
	 *
	 * @return void
	 */
	private function register_attachment_details_ability() {
		$this->register_ability_for_mcp(
			'godam/get-attachment-details',
			array(
				'label'               => __( 'Get GoDAM Attachment Details', 'godam' ),
				'description'         => __( 'Returns a GoDAM attachment record by WordPress or original GoDAM ID.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'id' => array(
							'type'        => array( 'integer', 'string' ),
							'description' => __( 'Attachment ID or original GoDAM ID.', 'godam' ),
						),
					),
					'required'             => array( 'id' ),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_read_media_library' ),
				'execute_callback'    => array( $this, 'get_attachment_details' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register update media metadata ability.
	 *
	 * @return void
	 */
	private function register_update_media_metadata_ability() {
		$this->register_ability_for_mcp(
			'godam/update-media-metadata',
			array(
				'label'               => __( 'Update GoDAM Media Metadata', 'godam' ),
				'description'         => __( 'Updates attachment metadata like title, caption, description, alt text, and slug.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'attachment_id' => array(
							'type'        => 'integer',
							'description' => __( 'Attachment ID to update.', 'godam' ),
						),
						'title'         => array(
							'type' => 'string',
						),
						'caption'       => array(
							'type' => 'string',
						),
						'description'   => array(
							'type' => 'string',
						),
						'alt_text'      => array(
							'type' => 'string',
						),
						'slug'          => array(
							'type' => 'string',
						),
					),
					'required'             => array( 'attachment_id' ),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_update_media_metadata' ),
				'execute_callback'    => array( $this, 'update_media_metadata' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => false,
						'destructive' => false,
						'idempotent'  => false,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register media folders ability.
	 *
	 * @return void
	 */
	private function register_media_folders_ability() {
		$this->register_ability_for_mcp(
			'godam/get-media-folders',
			array(
				'label'               => __( 'Get GoDAM Media Folders', 'godam' ),
				'description'         => __( 'Returns GoDAM media folders with the same filters as the plugin REST route.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'page'     => array(
							'type'        => 'integer',
							'description' => __( 'Page number.', 'godam' ),
						),
						'per_page' => array(
							'type'        => 'integer',
							'description' => __( 'Terms per page.', 'godam' ),
						),
						'parent'   => array(
							'type'        => 'integer',
							'description' => __( 'Parent term ID.', 'godam' ),
						),
						'bookmark' => array(
							'type'        => 'boolean',
							'description' => __( 'Whether to return bookmarked folders only.', 'godam' ),
						),
						'locked'   => array(
							'type'        => 'boolean',
							'description' => __( 'Whether to return locked folders only.', 'godam' ),
						),
					),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_read_media_library' ),
				'execute_callback'    => array( $this, 'get_media_folders' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register create media folder ability.
	 *
	 * @return void
	 */
	private function register_create_media_folder_ability() {
		$this->register_ability_for_mcp(
			'godam/create-media-folder',
			array(
				'label'               => __( 'Create GoDAM Media Folder', 'godam' ),
				'description'         => __( 'Creates a new GoDAM media folder.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'name'      => array(
							'type' => 'string',
						),
						'parent_id' => array(
							'type' => 'integer',
						),
					),
					'required'             => array( 'name' ),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_manage_media_folders' ),
				'execute_callback'    => array( $this, 'create_media_folder' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => false,
						'destructive' => false,
						'idempotent'  => false,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register rename media folder ability.
	 *
	 * @return void
	 */
	private function register_rename_media_folder_ability() {
		$this->register_ability_for_mcp(
			'godam/rename-media-folder',
			array(
				'label'               => __( 'Rename GoDAM Media Folder', 'godam' ),
				'description'         => __( 'Renames an existing GoDAM media folder.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'folder_id' => array(
							'type' => 'integer',
						),
						'name'      => array(
							'type' => 'string',
						),
					),
					'required'             => array( 'folder_id', 'name' ),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_manage_media_folders' ),
				'execute_callback'    => array( $this, 'rename_media_folder' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => false,
						'destructive' => false,
						'idempotent'  => false,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register delete media folders ability.
	 *
	 * @return void
	 */
	private function register_delete_media_folders_ability() {
		$this->register_ability_for_mcp(
			'godam/delete-media-folders',
			array(
				'label'               => __( 'Delete GoDAM Media Folders', 'godam' ),
				'description'         => __( 'Deletes one or more GoDAM media folders.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'folder_ids' => array(
							'type'  => 'array',
							'items' => array(
								'type' => 'integer',
							),
						),
					),
					'required'             => array( 'folder_ids' ),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_manage_media_folders' ),
				'execute_callback'    => array( $this, 'delete_media_folders' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => false,
						'destructive' => true,
						'idempotent'  => false,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register set media folder bookmark status ability.
	 *
	 * @return void
	 */
	private function register_set_media_folders_bookmark_status_ability() {
		$this->register_ability_for_mcp(
			'godam/set-media-folders-bookmark-status',
			array(
				'label'               => __( 'Set GoDAM Media Folder Bookmark Status', 'godam' ),
				'description'         => __( 'Bookmarks or unbookmarks one or more GoDAM media folders.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'folder_ids'      => array(
							'type'  => 'array',
							'items' => array(
								'type' => 'integer',
							),
						),
						'bookmark_status' => array(
							'type' => 'boolean',
						),
					),
					'required'             => array( 'folder_ids', 'bookmark_status' ),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_manage_media_folders' ),
				'execute_callback'    => array( $this, 'set_media_folders_bookmark_status' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => false,
						'destructive' => false,
						'idempotent'  => false,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register set media folder lock status ability.
	 *
	 * @return void
	 */
	private function register_set_media_folders_lock_status_ability() {
		$this->register_ability_for_mcp(
			'godam/set-media-folders-lock-status',
			array(
				'label'               => __( 'Set GoDAM Media Folder Lock Status', 'godam' ),
				'description'         => __( 'Locks or unlocks one or more GoDAM media folders.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'folder_ids'    => array(
							'type'  => 'array',
							'items' => array(
								'type' => 'integer',
							),
						),
						'locked_status' => array(
							'type' => 'boolean',
						),
					),
					'required'             => array( 'folder_ids', 'locked_status' ),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_manage_media_folders' ),
				'execute_callback'    => array( $this, 'set_media_folders_lock_status' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => false,
						'destructive' => false,
						'idempotent'  => false,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register transcoding status ability.
	 *
	 * @return void
	 */
	private function register_transcoding_status_ability() {
		$this->register_ability_for_mcp(
			'godam/get-transcoding-status',
			array(
				'label'               => __( 'Get GoDAM Transcoding Status', 'godam' ),
				'description'         => __( 'Returns GoDAM transcoding status for one or more attachment IDs.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'ids' => array(
							'type'        => 'array',
							'description' => __( 'Attachment IDs to inspect.', 'godam' ),
							'items'       => array(
								'type' => 'integer',
							),
						),
					),
					'required'             => array( 'ids' ),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_read_transcoding_status' ),
				'execute_callback'    => array( $this, 'get_transcoding_status' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register assign media to folder ability.
	 *
	 * @return void
	 */
	private function register_assign_media_to_folder_ability() {
		$this->register_ability_for_mcp(
			'godam/assign-media-to-folder',
			array(
				'label'               => __( 'Assign GoDAM Media To Folder', 'godam' ),
				'description'         => __( 'Assigns one or more media attachments into a GoDAM media folder.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'attachment_ids' => array(
							'type'  => 'array',
							'items' => array(
								'type' => 'integer',
							),
						),
						'folder_id'      => array(
							'type' => 'integer',
						),
					),
					'required'             => array( 'attachment_ids', 'folder_id' ),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_assign_media_to_folder' ),
				'execute_callback'    => array( $this, 'assign_media_to_folder' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => false,
						'destructive' => false,
						'idempotent'  => false,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register set video thumbnail ability.
	 *
	 * @return void
	 */
	private function register_set_video_thumbnail_ability() {
		$this->register_ability_for_mcp(
			'godam/set-video-thumbnail',
			array(
				'label'               => __( 'Set GoDAM Video Thumbnail', 'godam' ),
				'description'         => __( 'Sets the selected thumbnail URL for a GoDAM video attachment.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'attachment_id' => array(
							'type' => 'integer',
						),
						'thumbnail_url' => array(
							'type' => 'string',
						),
					),
					'required'             => array( 'attachment_id', 'thumbnail_url' ),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_edit_media_attachment' ),
				'execute_callback'    => array( $this, 'set_video_thumbnail_ability' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => false,
						'destructive' => false,
						'idempotent'  => false,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register upload custom video thumbnail ability.
	 *
	 * @return void
	 */
	private function register_upload_custom_video_thumbnail_ability() {
		$this->register_ability_for_mcp(
			'godam/upload-custom-video-thumbnail',
			array(
				'label'               => __( 'Upload GoDAM Custom Video Thumbnail', 'godam' ),
				'description'         => __( 'Adds a custom thumbnail URL to a GoDAM video attachment.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'attachment_id' => array(
							'type' => 'integer',
						),
						'thumbnail_url' => array(
							'type' => 'string',
						),
					),
					'required'             => array( 'attachment_id', 'thumbnail_url' ),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_edit_media_attachment' ),
				'execute_callback'    => array( $this, 'upload_custom_video_thumbnail_ability' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => false,
						'destructive' => false,
						'idempotent'  => false,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register delete custom video thumbnail ability.
	 *
	 * @return void
	 */
	private function register_delete_custom_video_thumbnail_ability() {
		$this->register_ability_for_mcp(
			'godam/delete-custom-video-thumbnail',
			array(
				'label'               => __( 'Delete GoDAM Custom Video Thumbnail', 'godam' ),
				'description'         => __( 'Removes a custom thumbnail URL from a GoDAM video attachment.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'attachment_id' => array(
							'type' => 'integer',
						),
						'thumbnail_url' => array(
							'type' => 'string',
						),
					),
					'required'             => array( 'attachment_id', 'thumbnail_url' ),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_edit_media_attachment' ),
				'execute_callback'    => array( $this, 'delete_custom_video_thumbnail_ability' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => false,
						'destructive' => true,
						'idempotent'  => false,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register retranscode media ability.
	 *
	 * @return void
	 */
	private function register_retranscode_media_ability() {
		$this->register_ability_for_mcp(
			'godam/retranscode-media',
			array(
				'label'               => __( 'Retranscode GoDAM Media', 'godam' ),
				'description'         => __( 'Retranscodes selected GoDAM media, or all candidate media when all_media is true.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'attachment_ids' => array(
							'type'  => 'array',
							'items' => array(
								'type' => 'integer',
							),
						),
						'all_media'      => array(
							'type' => 'boolean',
						),
						'force'          => array(
							'type' => 'boolean',
						),
					),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_manage_transcoding' ),
				'execute_callback'    => array( $this, 'retranscode_media_ability' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => false,
						'destructive' => false,
						'idempotent'  => false,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register site capabilities ability.
	 *
	 * @return void
	 */
	private function register_site_capabilities_ability() {
		$this->register_ability_for_mcp(
			'godam/get-site-capabilities',
			array(
				'label'               => __( 'Get GoDAM Site Capabilities', 'godam' ),
				'description'         => __( 'Returns WordPress, GoDAM, and Abilities API capability discovery for the current authenticated user.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_read_contract' ),
				'execute_callback'    => array( $this, 'get_site_capabilities_ability' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register entity search ability.
	 *
	 * @return void
	 */
	private function register_search_entities_ability() {
		$this->register_ability_for_mcp(
			'godam/search-entities',
			array(
				'label'               => __( 'Search GoDAM Entities', 'godam' ),
				'description'         => __( 'Searches GoDAM videos, attachments, or folders and returns ranked candidates for fuzzy resolution.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'entity' => array(
							'type' => 'string',
							'enum' => array( 'video', 'attachment', 'folder' ),
						),
						'query'  => array(
							'type' => 'string',
						),
						'limit'  => array(
							'type' => 'integer',
						),
					),
					'required'             => array( 'entity', 'query' ),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_read_media_library' ),
				'execute_callback'    => array( $this, 'search_entities_ability' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register transcoded video URLs ability.
	 *
	 * @return void
	 */
	private function register_transcoded_video_urls_ability() {
		$this->register_ability_for_mcp(
			'godam/get-transcoded-video-urls',
			array(
				'label'               => __( 'Get GoDAM Transcoded Video URLs', 'godam' ),
				'description'         => __( 'Returns transcoded video URLs with attachment details for GoDAM video attachments.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'limit' => array(
							'type' => 'integer',
						),
					),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_read_media_library' ),
				'execute_callback'    => array( $this, 'get_transcoded_video_urls_ability' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register rising trend videos ability.
	 *
	 * @return void
	 */
	private function register_rising_trend_videos_ability() {
		$this->register_ability_for_mcp(
			'godam/get-rising-trend-videos',
			array(
				'label'               => __( 'Get GoDAM Rising Trend Videos', 'godam' ),
				'description'         => __( 'Returns recent GoDAM videos with positive analytics growth.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'site_url' => array(
							'type' => 'string',
						),
						'limit'    => array(
							'type' => 'integer',
						),
					),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_read_media_library' ),
				'execute_callback'    => array( $this, 'get_rising_trend_videos_ability' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register media inventory bridge ability.
	 *
	 * @return void
	 */
	private function register_media_inventory_bridge_ability() {
		$this->register_ability_for_mcp(
			'godam/get-media-inventory',
			array(
				'label'               => __( 'Get GoDAM Media Inventory', 'godam' ),
				'description'         => __( 'Returns the normalized GoDAM media inventory response used by the Node MCP server.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'folderIds'  => array(
							'type'  => 'array',
							'items' => array( 'type' => 'integer' ),
						),
						'folderName' => array(
							'type' => 'string',
						),
						'page'       => array(
							'type' => 'integer',
						),
						'perPage'    => array(
							'type' => 'integer',
						),
						'bookmark'   => array(
							'type' => 'boolean',
						),
						'locked'     => array(
							'type' => 'boolean',
						),
						'search'     => array(
							'type' => 'string',
						),
					),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_read_media_library' ),
				'execute_callback'    => array( $this, 'get_media_inventory_bridge_ability' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register transcoding overview bridge ability.
	 *
	 * @return void
	 */
	private function register_transcoding_overview_bridge_ability() {
		$this->register_ability_for_mcp(
			'godam/get-transcoding-overview',
			array(
				'label'               => __( 'Get GoDAM Transcoding Overview', 'godam' ),
				'description'         => __( 'Returns the normalized GoDAM transcoding overview response used by the Node MCP server.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'attachmentIds' => array(
							'type'  => 'array',
							'items' => array( 'type' => 'integer' ),
						),
						'videoNames'    => array(
							'type'  => 'array',
							'items' => array( 'type' => 'string' ),
						),
						'statuses'      => array(
							'type'  => 'array',
							'items' => array( 'type' => 'string' ),
						),
						'limit'         => array(
							'type' => 'integer',
						),
						'onlyFailures'  => array(
							'type' => 'boolean',
						),
					),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_read_transcoding_status' ),
				'execute_callback'    => array( $this, 'get_transcoding_overview_bridge_ability' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register upload or transcode status bridge ability.
	 *
	 * @return void
	 */
	private function register_upload_or_transcode_status_bridge_ability() {
		$this->register_ability_for_mcp(
			'godam/get-upload-or-transcode-status',
			array(
				'label'               => __( 'Get GoDAM Upload Or Transcode Status', 'godam' ),
				'description'         => __( 'Returns the normalized upload or transcode status response used by the Node MCP server.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'attachmentId'   => array(
							'type' => 'integer',
						),
						'attachmentName' => array(
							'type' => 'string',
						),
					),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_read_media_library' ),
				'execute_callback'    => array( $this, 'get_upload_or_transcode_status_bridge_ability' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register upload video to media bridge ability.
	 *
	 * @return void
	 */
	private function register_upload_video_to_media_bridge_ability() {
		$this->register_ability_for_mcp(
			'godam/upload-video-to-media',
			array(
				'label'               => __( 'Upload GoDAM Video To Media', 'godam' ),
				'description'         => __( 'Returns the normalized upload-to-media response used by the Node MCP server.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'localFilePath'   => array( 'type' => 'string' ),
						'attachmentUri'   => array( 'type' => 'string' ),
						'remoteUrl'       => array( 'type' => 'string' ),
						'title'           => array( 'type' => 'string' ),
						'folderId'        => array( 'type' => 'integer' ),
						'folderName'      => array( 'type' => 'string' ),
						'confirm'         => array( 'type' => 'boolean' ),
						'resolutionLimit' => array( 'type' => 'integer' ),
					),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_manage_media_folders' ),
				'execute_callback'    => array( $this, 'upload_video_to_media_bridge_ability' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => false,
						'destructive' => false,
						'idempotent'  => false,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register upload and track transcode bridge ability.
	 *
	 * @return void
	 */
	private function register_upload_and_track_transcode_bridge_ability() {
		$this->register_ability_for_mcp(
			'godam/upload-and-track-transcode',
			array(
				'label'               => __( 'Upload And Track GoDAM Transcode', 'godam' ),
				'description'         => __( 'Returns the normalized upload-and-track-transcode response used by the Node MCP server.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'localFilePath'     => array( 'type' => 'string' ),
						'attachmentUri'     => array( 'type' => 'string' ),
						'remoteUrl'         => array( 'type' => 'string' ),
						'title'             => array( 'type' => 'string' ),
						'folderId'          => array( 'type' => 'integer' ),
						'folderName'        => array( 'type' => 'string' ),
						'confirm'           => array( 'type' => 'boolean' ),
						'resolutionLimit'   => array( 'type' => 'integer' ),
						'waitForCompletion' => array( 'type' => 'boolean' ),
						'timeoutMs'         => array( 'type' => 'integer' ),
						'pollIntervalMs'    => array( 'type' => 'integer' ),
					),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_manage_media_folders' ),
				'execute_callback'    => array( $this, 'upload_and_track_transcode_bridge_ability' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => false,
						'destructive' => false,
						'idempotent'  => false,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register dashboard metrics ability.
	 *
	 * @return void
	 */
	private function register_dashboard_metrics_ability() {
		$this->register_ability_for_mcp(
			'godam/get-dashboard-metrics',
			array(
				'label'               => __( 'Get GoDAM Dashboard Metrics', 'godam' ),
				'description'         => __( 'Returns GoDAM dashboard metrics for a site URL.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'site_url' => array(
							'type'        => 'string',
							'description' => __( 'The site URL to load dashboard metrics for.', 'godam' ),
						),
					),
					'required'             => array( 'site_url' ),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'properties'           => array(
						'status'            => array( 'type' => 'string' ),
						'dashboard_metrics' => array( 'type' => 'object' ),
					),
					'required'             => array( 'status' ),
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_read_media_library' ),
				'execute_callback'    => array( $this, 'get_dashboard_metrics' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register dashboard history ability.
	 *
	 * @return void
	 */
	private function register_dashboard_history_ability() {
		$this->register_ability_for_mcp(
			'godam/get-dashboard-history',
			array(
				'label'               => __( 'Get GoDAM Dashboard History', 'godam' ),
				'description'         => __( 'Returns GoDAM dashboard history for a site URL.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'site_url' => array(
							'type'        => 'string',
							'description' => __( 'The site URL to load dashboard history for.', 'godam' ),
						),
						'days'     => array(
							'type'        => 'integer',
							'description' => __( 'The number of days to include in the dashboard history.', 'godam' ),
						),
					),
					'required'             => array( 'site_url' ),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'properties'           => array(
						'status'                    => array( 'type' => 'string' ),
						'dashboard_metrics_history' => array( 'type' => 'array' ),
					),
					'required'             => array( 'status', 'dashboard_metrics_history' ),
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_read_media_library' ),
				'execute_callback'    => array( $this, 'get_dashboard_history' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register top videos ability.
	 *
	 * @return void
	 */
	private function register_top_videos_ability() {
		$this->register_ability_for_mcp(
			'godam/get-top-videos',
			array(
				'label'               => __( 'Get GoDAM Top Videos', 'godam' ),
				'description'         => __( 'Returns the top GoDAM videos for a site URL.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'site_url' => array(
							'type'        => 'string',
							'description' => __( 'The site URL to load top videos for.', 'godam' ),
						),
						'page'     => array(
							'type'        => 'integer',
							'description' => __( 'The result page number.', 'godam' ),
							'default'     => 1,
						),
						'limit'    => array(
							'type'        => 'integer',
							'description' => __( 'Maximum videos to return.', 'godam' ),
							'default'     => 10,
						),
					),
					'required'             => array( 'site_url' ),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'properties'           => array(
						'status'      => array( 'type' => 'string' ),
						'top_videos'  => array( 'type' => 'array' ),
						'total_pages' => array( 'type' => array( 'integer', 'number', 'string' ) ),
					),
					'required'             => array( 'status', 'top_videos' ),
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_read_media_library' ),
				'execute_callback'    => array( $this, 'get_top_videos' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register video analytics summary ability.
	 *
	 * @return void
	 */
	private function register_video_analytics_summary_ability() {
		$this->register_ability_for_mcp(
			'godam/get-video-analytics-summary',
			array(
				'label'               => __( 'Get GoDAM Video Analytics Summary', 'godam' ),
				'description'         => __( 'Returns GoDAM analytics for a specific video and site URL.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'site_url' => array(
							'type'        => 'string',
							'description' => __( 'The site URL associated with the video.', 'godam' ),
						),
						'video_id' => array(
							'type'        => 'integer',
							'description' => __( 'The video ID to load analytics for.', 'godam' ),
						),
					),
					'required'             => array( 'site_url', 'video_id' ),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'properties'           => array(
						'status' => array( 'type' => 'string' ),
						'data'   => array( 'type' => 'object' ),
					),
					'required'             => array( 'status', 'data' ),
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_read_media_library' ),
				'execute_callback'    => array( $this, 'get_video_analytics_summary' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Register video analytics history ability.
	 *
	 * @return void
	 */
	private function register_video_analytics_history_ability() {
		$this->register_ability_for_mcp(
			'godam/get-video-analytics-history',
			array(
				'label'               => __( 'Get GoDAM Video Analytics History', 'godam' ),
				'description'         => __( 'Returns GoDAM analytics history for a specific video and site URL.', 'godam' ),
				'category'            => 'godam-mcp',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'site_url' => array(
							'type'        => 'string',
							'description' => __( 'The site URL associated with the video.', 'godam' ),
						),
						'video_id' => array(
							'type'        => 'integer',
							'description' => __( 'The video ID to load analytics history for.', 'godam' ),
						),
						'days'     => array(
							'type'        => 'integer',
							'description' => __( 'The number of days to include in the history window.', 'godam' ),
						),
					),
					'required'             => array( 'site_url', 'video_id' ),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'properties'           => array(
						'status'              => array( 'type' => 'string' ),
						'processed_analytics' => array( 'type' => 'array' ),
					),
					'required'             => array( 'status', 'processed_analytics' ),
					'additionalProperties' => true,
				),
				'permission_callback' => array( $this, 'can_read_media_library' ),
				'execute_callback'    => array( $this, 'get_video_analytics_history' ),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Check whether the current user can read the MCP contract.
	 *
	 * @return bool|WP_Error
	 */
}
