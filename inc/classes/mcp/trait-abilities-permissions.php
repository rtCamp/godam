<?php
/**
 * MCP abilities partial: Abilities_Permissions.
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
 * Abilities_Permissions trait.
 */
trait Abilities_Permissions {

	/**
	 * Check whether the current user can read the MCP contract.
	 *
	 * @return bool|WP_Error
	 */
	public function can_read_contract() {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'godam_mcp_auth_required', __( 'Authentication is required to access the GoDAM MCP contract.', 'godam' ) );
		}

		if ( ! current_user_can( 'read' ) ) {
			return new WP_Error( 'godam_mcp_forbidden', __( 'You do not have permission to access the GoDAM MCP contract.', 'godam' ) );
		}

		return true;
	}

	/**
	 * Check whether the current user can read media library abilities.
	 *
	 * @return bool|WP_Error
	 */
	public function can_read_media_library() {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'godam_mcp_auth_required', __( 'Authentication is required to access GoDAM media abilities.', 'godam' ) );
		}

		if ( ! current_user_can( 'upload_files' ) ) {
			return new WP_Error( 'godam_mcp_forbidden', __( 'You do not have permission to access GoDAM media abilities.', 'godam' ) );
		}

		return true;
	}

	/**
	 * Check whether the current user can mutate media folder abilities.
	 *
	 * @return bool|WP_Error
	 */
	public function can_manage_media_folders() {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'godam_mcp_auth_required', __( 'Authentication is required to manage GoDAM media folders.', 'godam' ) );
		}

		if ( ! current_user_can( 'upload_files' ) ) {
			return new WP_Error( 'godam_mcp_forbidden', __( 'You do not have permission to manage GoDAM media folders.', 'godam' ) );
		}

		return true;
	}

	/**
	 * Check whether the current user can update media metadata.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return bool|WP_Error
	 */
	public function can_update_media_metadata( $input = null ) {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'godam_mcp_auth_required', __( 'Authentication is required to update media metadata.', 'godam' ) );
		}

		if ( ! current_user_can( 'upload_files' ) ) {
			return new WP_Error( 'godam_mcp_forbidden', __( 'You do not have permission to update media metadata.', 'godam' ) );
		}

		$attachment_id = isset( $input['attachment_id'] ) ? absint( $input['attachment_id'] ) : 0;

		if ( $attachment_id && ! current_user_can( 'edit_post', $attachment_id ) ) {
			return new WP_Error( 'godam_mcp_forbidden', __( 'You do not have permission to edit this media item.', 'godam' ) );
		}

		return true;
	}

	/**
	 * Check whether the current user can assign media to folders.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return bool|WP_Error
	 */
	public function can_assign_media_to_folder( $input = null ) {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'godam_mcp_auth_required', __( 'Authentication is required to assign media to folders.', 'godam' ) );
		}

		if ( ! current_user_can( 'edit_posts' ) ) {
			return new WP_Error( 'godam_mcp_forbidden', __( 'You do not have permission to assign media to folders.', 'godam' ) );
		}

		$attachment_ids = isset( $input['attachment_ids'] ) && is_array( $input['attachment_ids'] ) ? array_values( array_filter( array_map( 'absint', $input['attachment_ids'] ) ) ) : array();

		foreach ( $attachment_ids as $attachment_id ) {
			if ( ! current_user_can( 'edit_post', $attachment_id ) ) {
				return new WP_Error( 'godam_mcp_forbidden', __( 'You do not have permission to edit one or more media items.', 'godam' ) );
			}
		}

		return true;
	}

	/**
	 * Check whether the current user can edit a media attachment.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return bool|WP_Error
	 */
	public function can_edit_media_attachment( $input = null ) {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'godam_mcp_auth_required', __( 'Authentication is required to edit GoDAM media.', 'godam' ) );
		}

		$attachment_id = isset( $input['attachment_id'] ) ? absint( $input['attachment_id'] ) : 0;

		if ( ! current_user_can( 'edit_posts' ) || ( $attachment_id && ! current_user_can( 'edit_post', $attachment_id ) ) ) {
			return new WP_Error( 'godam_mcp_forbidden', __( 'You do not have permission to edit this media item.', 'godam' ) );
		}

		return true;
	}

	/**
	 * Check whether the current user can manage retranscoding.
	 *
	 * @return bool|WP_Error
	 */
	public function can_manage_transcoding() {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'godam_mcp_auth_required', __( 'Authentication is required to manage retranscoding.', 'godam' ) );
		}

		if ( ! current_user_can( 'edit_others_posts' ) ) {
			return new WP_Error( 'godam_mcp_forbidden', __( 'You do not have permission to manage retranscoding.', 'godam' ) );
		}

		return true;
	}

	/**
	 * Check whether the current user can read transcoding status abilities.
	 *
	 * @return bool|WP_Error
	 */
	public function can_read_transcoding_status() {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'godam_mcp_auth_required', __( 'Authentication is required to access GoDAM transcoding abilities.', 'godam' ) );
		}

		if ( ! current_user_can( 'upload_files' ) ) {
			return new WP_Error( 'godam_mcp_forbidden', __( 'You do not have permission to access GoDAM transcoding abilities.', 'godam' ) );
		}

		return true;
	}

	/**
	 * Return the MCP route contract.
	 *
	 * @return array<string, mixed>
	 */
}
