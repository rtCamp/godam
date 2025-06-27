<?php
/**
 * Restrict access to all files/media from unauthorized users.
 */

namespace RTGODAM\Inc\Filesystem\Acl\Restrict_All_Files;

use const RTGODAM\Inc\Filesystem\Acl\FILE_IS_PRIVATE_AND_DENIED;
use const RTGODAM\Inc\Filesystem\Acl\FILE_IS_PRIVATE_AND_ALLOWED;

function check_file_visibility() {
	if ( ! is_user_logged_in() ) {
		return FILE_IS_PRIVATE_AND_DENIED;
	}

	$user_has_read_permissions = current_user_can( 'read' );
	if ( ! $user_has_read_permissions ) {
		return FILE_IS_PRIVATE_AND_DENIED;
	}

	return FILE_IS_PRIVATE_AND_ALLOWED;
}
