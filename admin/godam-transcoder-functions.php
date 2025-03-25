<?php
/**
 * Transcoder functions.
 *
 * @since      1.0.0
 *
 * @package    Transcoder
 * @subpackage Transcoder/Functions
 */

defined( 'ABSPATH' ) || exit;

/**
 * Return instance of RTGODAM_Transcoder_Admin Class.
 *
 * @since   1.0.0
 *
 * @return object
 */
function rtgodam_admin() {
	global $rtgodam_transcoder_admin;
	return $rtgodam_transcoder_admin;
}

/**
 * Builds the [rtgodam_media] shortcode output.
 *
 * If media type is video then display transcoded video (mp4 format) if any else original video.
 *
 * If media type is audio then display transcoded audio (mp3 format) if any else original audio.
 *
 * @since 1.0.0
 *
 * @param array  $attrs {
 *     Attributes of the shortcode.
 *
 *     @type int $attachment_id     ID of attachment.
 * }
 * @param  string $content  Shortcode content.
 * @return string|void      HTML content to display video.
 */
function rtgodam_media_shortcode( $attrs, $content = '' ) {

	if ( empty( $attrs['attachment_id'] ) ) {
		return false;
	}

	$attachment_id = $attrs['attachment_id'];

	$type = get_post_mime_type( $attachment_id );

	if ( empty( $type ) ) {
		return false;
	}

	$mime_type = explode( '/', $type );
	$media_url = '';

	if ( 'video' === $mime_type[0] ) {

		$video_shortcode_attributes = '';
		$media_url                  = rtgodam_get_media_url( $attachment_id );

		$poster = rtgodam_media_get_video_thumbnail( $attachment_id );

		$attrs['src']    = $media_url;
		$attrs['poster'] = $poster;

		foreach ( $attrs as $key => $value ) {
			$video_shortcode_attributes .= ' ' . $key . '="' . $value . '"';
		}

		$content = do_shortcode( "[video {$video_shortcode_attributes}]" );

	} elseif ( 'audio' === $mime_type[0] ) {

		$media_url = rtgodam_get_media_url( $attachment_id, 'mp3' );

		$audio_shortcode_attributes = 'src="' . $media_url . '"';

		foreach ( $attrs as $key => $value ) {
			$audio_shortcode_attributes .= ' ' . $key . '="' . $value . '"';
		}

		$content = do_shortcode( "[audio {$audio_shortcode_attributes}]" );

	} elseif ( 'image' === $mime_type[0] ) {

		$content = '<p>' . esc_html__( 'Image attachments are not handled by Transcoder plugin.', 'godam' ) . '</p>';

	}

	if ( rtgodam_is_file_being_transcoded( $attachment_id ) ) {
		$content .= '<p class="transcoding-in-progress"> ' . esc_html__( 'This file is being transcoded. Please wait.', 'godam' ) . '</p>';
	}

	/**
	 * Allow user to filter [rtgodam_media] short code content.
	 *
	 * @since 1.0.0
	 *
	 * @param string $content       Activity content.
	 * @param int $attachment_id    ID of attachment.
	 * @param string $media_url     URL of the media.
	 * @param string $media_type    Mime type of the media.
	 */
	return apply_filters( 'rtgodam_media_shortcode', $content, $attachment_id, $media_url, $mime_type[0] );
}

add_shortcode( 'rtgodam_media', 'rtgodam_media_shortcode' );

/**
 * Check whether the file is sent to the transcoder or not.
 *
 * @since   1.0.0
 *
 * @param  number $attachment_id    ID of attachment.
 * @return boolean
 */
function rtgodam_is_file_being_transcoded( $attachment_id ) {
	$job_id = get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );
	if ( ! empty( $job_id ) ) {
		$transcoded_files  = get_post_meta( $attachment_id, 'rtgodam_media_transcoded_files', true );
		$transcoded_thumbs = get_post_meta( $attachment_id, 'rtgodam_media_thumbnails', true );
		if ( empty( $transcoded_files ) && empty( $transcoded_thumbs ) ) {
			return true;
		}
	}
	return false;
}

/**
 * Give the transcoded video's thumbnail stored in videos meta.
 *
 * @since 1.0.0
 *
 * @param  int $attachment_id   ID of attachment.
 * @return string               returns image file url on success.
 */
function rtgodam_media_get_video_thumbnail( $attachment_id ) {

	if ( empty( $attachment_id ) ) {
		return;
	}

	$thumbnails = get_post_meta( $attachment_id, 'rtgodam_media_video_thumbnail', true );

	if ( ! empty( $thumbnails ) ) {

		$file_url = $thumbnails;
		// for WordPress backward compatibility.
		if ( function_exists( 'wp_get_upload_dir' ) ) {
			$uploads = wp_get_upload_dir();
		} else {
			$uploads = wp_upload_dir();
		}

		if ( 0 === strpos( $file_url, $uploads['baseurl'] ) ) {
			$final_file_url = $file_url;
		} else {
			$final_file_url = $uploads['baseurl'] . '/' . $file_url;
		}

		$final_file_url = apply_filters( 'rtgodam_transcoded_file_url', $final_file_url, $attachment_id );

		return $final_file_url;
	}

	return false;
}

/**
 * Give the transcoded media URL of attachment.
 *
 * @since 1.0.0
 *
 * @param  int    $attachment_id     ID of attachment.
 * @param  string $media_type        Type of media i.e mp4, mp3. By default it mp4 is passed.
 * @return string                    Returns audio file url on success.
 */
function rtgodam_get_media_url( $attachment_id, $media_type = 'mp4' ) {

	if ( empty( $attachment_id ) ) {
		return;
	}

	$medias = get_post_meta( $attachment_id, 'rtgodam_media_transcoded_files', true );

	if ( isset( $medias[ $media_type ] ) && is_array( $medias[ $media_type ] ) && ! empty( $medias[ $media_type ][0] ) ) {
		$file_url = $medias[ $media_type ][0];
		// for WordPress backward compatibility.
		if ( function_exists( 'wp_get_upload_dir' ) ) {
			$uploads = wp_get_upload_dir();
		} else {
			$uploads = wp_upload_dir();
		}
		if ( 0 === strpos( $file_url, $uploads['baseurl'] ) ) {
			$final_file_url = $file_url;
		} else {
			$final_file_url = $uploads['baseurl'] . '/' . $file_url;
		}
		$final_file_url = apply_filters( 'rtgodam_transcoded_file_url', $final_file_url, $attachment_id );
	} else {
		$final_file_url = wp_get_attachment_url( $attachment_id );
	}

	return $final_file_url;
}

/**
 * Update the activity after thumb is set to the video.
 *
 * @since 1.0.0
 *
 * @param number $id media id.
 *
 * @return void
 */
function rtgodam_update_activity_after_thumb_set( $id ) {

	$model       = new RTMediaModel();
	$media_obj   = new RTMediaMedia();
	$media       = $model->get( array( 'id' => $id ) );
	$privacy     = $media[0]->privacy;
	$activity_id = rtmedia_activity_id( $id );
	if ( ! empty( $activity_id ) ) {
		$same_medias           = $media_obj->model->get( array( 'activity_id' => $activity_id ) );
		$update_activity_media = array();
		foreach ( $same_medias as $a_media ) {
			$update_activity_media[] = $a_media->id;
		}
		$obj_activity = new RTMediaActivity( $update_activity_media, $privacy, false );
		global $bp;
		$activity_old_content = bp_activity_get_meta( $activity_id, 'bp_old_activity_content' );
		$activity_text        = bp_activity_get_meta( $activity_id, 'bp_activity_text' );
		if ( ! empty( $activity_old_content ) ) {
			// get old activity content and save in activity meta.
			$activity_get  = bp_activity_get_specific( array( 'activity_ids' => $activity_id ) );
			$activity      = $activity_get['activities'][0];
			$activity_body = $activity->content;
			bp_activity_update_meta( $activity_id, 'bp_old_activity_content', $activity_body );
			// extract activity text from old content.
			$activity_text = wp_kses( $activity_body, array( '<span>' => array() ) );
			$activity_text = explode( '</span>', $activity_text );
			$activity_text = wp_strip_all_tags( $activity_text[0] );
			bp_activity_update_meta( $activity_id, 'bp_activity_text', $activity_text );
		}
		$activity_text               = bp_activity_get_meta( $activity_id, 'bp_activity_text' );
		$obj_activity->activity_text = $activity_text;
		global $wpdb;
		$wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.DirectQuery
			$bp->activity->table_name,
			array(
				'type'    => 'rtmedia_update',
				'content' => $obj_activity->create_activity_html(),
			),
			array( 'id' => $activity_id )
		);
	}
}

/**
 * Retrieve edit posts link for post. Derived from WordPress core
 *
 * Can be used within the WordPress loop or outside of it. Can be used with
 * pages, posts, attachments, and revisions.
 *
 * @since 1.0.0
 *
 * @param int    $id      Optional. Post ID.
 * @param string $context Optional, defaults to display.
 * @return string|null The edit post link for the given post. null if the post type is invalid or does
 *                     not allow an editing UI.
 */
function rtgodam_get_edit_post_link( $id = 0, $context = 'display' ) {
	$_post = get_post( $id );
	if ( empty( $_post ) ) {
		return;
	}

	if ( 'revision' === $_post->post_type ) {
		$action = '';
	} elseif ( 'display' === $context ) {
		$action = '&amp;action=edit';
	} else {
		$action = '&action=edit';
	}

	$post_type_object = get_post_type_object( $_post->post_type );
	if ( ! $post_type_object ) {
		return;
	}

	if ( $post_type_object->_edit_link ) {
		$link = admin_url( sprintf( $post_type_object->_edit_link . $action, $_post->ID ) );
	} else {
		$link = '';
	}

	return $link;
}

/**
 * Get the job id of attachment
 *
 * @since 1.0.0
 *
 * @param number $attachment_id Attachment id.
 *
 * @return number On success it returns the job id otherwise it returns the false.
 */
function rtgodam_get_job_id_by_attachment_id( $attachment_id ) {

	if ( empty( $attachment_id ) ) {
		return 0;
	}

	$job_id = get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );

	return $job_id ? $job_id : 0;
}

/**
 * Generate the video short code when non supported media is inserted in content area
 *
 * @since  1.0
 *
 * @param string $html       Short code for the media.
 * @param number $send_id    Unique id for the short code.
 * @param array  $attachment Attachment array.
 *
 * @return string
 */
function rtgodam_generate_video_shortcode( $html, $send_id, $attachment ) {

	if ( empty( $attachment ) ) {
		return $html;
	}

	$post_mime_type = get_post_mime_type( $attachment['id'] );
	$mime_type      = explode( '/', $post_mime_type );

	$medias = get_post_meta( $attachment['id'], 'rtgodam_media_transcoded_files', true );

	if ( 0 === strpos( $post_mime_type, '[audio' ) || 0 === strpos( $post_mime_type, '[video' ) ) {
		return $html;
	}

	if ( empty( $medias ) ) {
		return $html;
	}

	if ( ! empty( $mime_type ) && 0 === strpos( $post_mime_type, 'video' ) ) {
		$transcoded_file_url = rtgodam_get_media_url( $attachment['id'] );
		if ( empty( $transcoded_file_url ) ) {
			return $html;
		}

		$transcoded_thumb_url = rtgodam_media_get_video_thumbnail( $attachment['id'] );

		$poster = '';
		if ( ! empty( $transcoded_thumb_url ) ) {
			$poster = 'poster="' . $transcoded_thumb_url . '"';
		}

		$html = '[video src="' . $transcoded_file_url . '" ' . $poster . ' ]';
	} elseif ( ! empty( $mime_type ) && 0 === strpos( $post_mime_type, 'audio' ) ) {
		$transcoded_file_url = rtgodam_get_media_url( $attachment['id'] );
		if ( empty( $transcoded_file_url ) ) {
			return $html;
		}

		$html = '[audio src="' . $transcoded_file_url . '"]';
	}

	return $html;
}

add_filter( 'media_send_to_editor', 'rtgodam_generate_video_shortcode', 100, 3 );

/**
 * Check if track status setting is enabled.
 *
 * This function retrieves the EasyDAM settings and checks the `track_status` value under the `general` section.
 *
 * @since 1.0.0
 *
 * @return boolean TRUE if track status is enabled, FALSE otherwise.
 */
function rtgodam_is_track_status_enabled() {
	// Fetch EasyDAM settings from the database.
	$easydam_settings = get_option( 'rtgodam-settings', array() );

	// Check and return the track_status value, defaulting to false if not set.
	return ! empty( $easydam_settings['general']['track_status'] ) && $easydam_settings['general']['track_status'];
}

/**
 * Add the notice when file is sent for the transcoding and adds the poster thumbnail if poster tag is empty
 * This function also works as a backward compatibility for the rtAmazon S3 plugin
 *
 * @since 1.0.1
 *
 * @param string      $content  HTML contents of the activity.
 * @param object|null $activity Activity object.
 *
 * @return string
 */
function rtgodam_bp_get_activity_content( $content, $activity = null ) {

	if ( empty( $activity ) || empty( $content ) ) {
		return $content;
	}

	if ( class_exists( 'RTMediaModel' ) ) {
		$rtgodam_model  = new RTMediaModel();
		$all_media = $rtgodam_model->get( array( 'activity_id' => $activity->id ) );
		if ( empty( $all_media ) ) {
			return $content;
		}

		// Filter all video objects. So we only get video objects in $all_media array.
		foreach ( $all_media as $key => $media ) {
			if ( 'video' !== $media->media_type ) {
				unset( $all_media[ $key ] );
			}
		}

		// Reset the array keys. Changing SORT_DESC from SORT_ASC because $video_src_url is in desc order.
		array_multisort( $all_media, SORT_DESC );

		// Get all the video src.
		$search_video_url = '/<video.+(src=["]([^"]*)["])/';
		preg_match_all( $search_video_url, $content, $video_src_url );

		// Get all the poster src.
		$search_poster_url = '/<video.+(poster=["]([^"]*)["])/';
		preg_match_all( $search_poster_url, $content, $poster_url );

		$uploads = wp_upload_dir();

		// Iterate through each media.
		foreach ( $all_media as $key => $media ) {
			// Get default video thumbnail stored for this particular video in post meta.
			$wp_video_thumbnail = get_post_meta( $media->media_id, 'rtgodam_media_video_thumbnail', true );

			if ( ! empty( $video_src_url[2] ) ) {

				$transcoded_media_url = rtgodam_get_media_url( $media->media_id );

				if ( ! empty( $transcoded_media_url ) ) {
					$content = preg_replace( '/' . str_replace( '/', '\/', $video_src_url[2][ $key ] ) . '/', $transcoded_media_url, $content, 1 );
				}
			}

			// Make the URL absolute.
			if ( ! empty( $wp_video_thumbnail ) ) {
				$file_url = $wp_video_thumbnail;

				if ( 0 === strpos( $file_url, $uploads['baseurl'] ) ) {
					$final_file_url = $file_url;
				} else {
					$final_file_url = $uploads['baseurl'] . '/' . $file_url;
				}
				// Thumbnail/poster URL.
				$final_file_url = apply_filters( 'rtgodam_transcoded_file_url', $final_file_url, $media->media_id );
				// Replace the first poster (assuming activity has multiple medias in it).
				if ( rtgodam_is_file_being_transcoded( $media->media_id ) ) {
					$content = preg_replace( '/' . str_replace( '/', '\/', $poster_url[1][ $key ] ) . '/', 'poster="' . $final_file_url . '"', $content, 1 );
				}
			}
			// If media is sent to the transcoder then show the message.
			if ( rtgodam_is_file_being_transcoded( $media->media_id ) ) {
				if ( current_user_can( 'manage_options' ) && rtgodam_is_track_status_enabled() ) {

					$check_button_text = __( 'Check Status', 'godam' );

					/**
					 * Filters the text of transcoding process status check button.
					 *
					 * @since 1.2
					 *
					 * @param string $check_button_text Default text of transcoding process status check button.
					 */
					$check_button_text = apply_filters( 'rtgodam_transcoder_check_status_button_text', $check_button_text );

					$message = sprintf(
						'<div class="transcoding-in-progress"><button id="btn_check_status%1$s" class="btn_check_transcode_status" name="check_status_btn" data-value="%1$s">%2$s</button> <div class="transcode_status_box" id="span_status%1$s">%3$s</div></div>',
						esc_attr( $media->media_id ),
						esc_html( $check_button_text ),
						esc_html__( 'This file is converting. Please refresh the page after some time.', 'godam' )
					);

				} else {
					$message = sprintf(
						'<p class="transcoding-in-progress">%s</p>',
						esc_html__( 'This file is converting. Please refresh the page after some time.', 'godam' )
					);
				}
				/**
				 * Allow user to filter the message text.
				 *
				 * @since 1.0.2
				 *
				 * @param string $message   Message to be displayed.
				 * @param object $activity  Activity object.
				 */
				$message  = apply_filters( 'rtgodam_transcoding_in_progress_message', $message, $activity );
				$message .= '</div>';
				// Add this message to the particular media (there can be multiple medias in the activity).
				$search     = '/(rtgodam_media_video_' . $media->id . ")['\"](.*?)(<\/a><\/div>)/s";
				$text_found = array();
				preg_match( $search, $content, $text_found );

				if ( ! empty( $text_found[0] ) ) {
					$content = str_replace( $text_found[0], $text_found[1] . '"' . $text_found[2] . '</a>' . $message, $content );
				}
			}
		}
		$search     = '/(<div class="rtmedia-item-title")(.*?)(>)/s';
		$text_found = array();
		global $rtmedia;
		$text_to_be_entered = " style='max-width:" . esc_attr( $rtmedia->options['defaultSizes_video_activityPlayer_width'] ) . "px;' ";
		preg_match( $search, $content, $text_found );
		if ( ! empty( $text_found[0] ) ) {
				$content = str_replace( $text_found[0], $text_found[1] . $text_to_be_entered . $text_found[3], $content );
		}
		return $content;
	} else {
		return $content;
	}
}

add_filter( 'bp_get_activity_content_body', 'rtgodam_bp_get_activity_content', 99, 2 );

/**
 * Parse the URL - Derived from the WordPress core
 *
 * @since 1.0.4
 *
 * @param  string $url The URL to be parsed.
 * @return array       Array containing the information about the URL.
 */
function rtgodam_wp_parse_url( $url ) {
	if ( function_exists( 'wp_parse_url' ) ) {
		return wp_parse_url( $url );
	}
	$parts = wp_parse_url( $url );
	if ( ! $parts ) {
		// < PHP 5.4.7 compat, trouble with relative paths including a scheme break in the path
		if ( '/' === $url[0] && false !== strpos( $url, '://' ) ) {
			// Since we know it's a relative path, prefix with a scheme/host placeholder and try again.
			$parts = wp_parse_url( 'placeholder://placeholder' . $url );
			if ( empty( $parts ) ) {
				return $parts;
			}
			// Remove the placeholder values.
			unset( $parts['scheme'], $parts['host'] );
		} else {
			return $parts;
		}
	}

	// < PHP 5.4.7 compat, doesn't detect schemeless URL's host field
	if ( '//' === substr( $url, 0, 2 ) && ! isset( $parts['host'] ) ) {
		$path_parts    = explode( '/', substr( $parts['path'], 2 ), 2 );
		$parts['host'] = $path_parts[0];
		if ( isset( $path_parts[1] ) ) {
			$parts['path'] = '/' . $path_parts[1];
		} else {
			unset( $parts['path'] );
		}
	}
	return $parts;
}

/**
 * Deletes the transcoded files related to the attachment
 *
 * @since 1.0.5
 *
 * @param  int $post_id Attachment ID.
 */
function rtgodam_delete_related_transcoded_files( $post_id ) {
	if ( empty( $post_id ) ) {
		return false;
	}

	$transcoded_files = get_post_meta( $post_id, 'rtgodam_media_transcoded_files', true );

	if ( ! empty( $transcoded_files ) && is_array( $transcoded_files ) ) {
		foreach ( $transcoded_files as $files ) {
			if ( ! empty( $files ) && is_array( $files ) ) {
				rtgodam_delete_transcoded_files( $files );
			}
		}
	}
	delete_post_meta( $post_id, 'rtgodam_media_transcoded_files' );

	$thumbnails = get_post_meta( $post_id, 'rtgodam_media_thumbnails', true );
	if ( ! empty( $thumbnails ) && is_array( $thumbnails ) ) {
		rtgodam_delete_transcoded_files( $thumbnails );
	}
	delete_post_meta( $post_id, 'rtgodam_media_thumbnails' );
}

add_action( 'delete_attachment', 'rtgodam_delete_related_transcoded_files', 99, 1 );

/**
 * Deletes/Unlinks the files given in the array
 *
 * @since 1.0.5
 *
 * @param mixed $files Files array or file path string.
 *
 * @return void
 */
function rtgodam_delete_transcoded_files( $files ) {

	if ( empty( $files ) ) {
		return;
	}

	if ( ! empty( $files ) && ! is_array( $files ) ) {
		$files = array( $files );
	}

	$uploadpath = rtgodam_get_upload_dir();

	foreach ( $files as $file ) {
		if ( ! empty( $file ) ) {
			$file_path = path_join( $uploadpath['basedir'], $file );
			\RTGODAM\Inc\FileSystem::delete_file( $file_path );
		}
	}
}

/**
 * Gets the information about the upload directory
 *
 * On success, the returned array will have many indices:
 * 'path' - base directory and sub directory or full path to upload directory.
 * 'url' - base url and sub directory or absolute URL to upload directory.
 * 'subdir' - sub directory if uploads use year/month folders option is on.
 * 'basedir' - path without subdir.
 * 'baseurl' - URL path without subdir.
 * 'error' - false or error message.
 *
 * @since 1.0.5
 *
 * @return array See above for description.
 */
function rtgodam_get_upload_dir() {
	// for WordPress backward compatibility.
	if ( function_exists( 'wp_get_upload_dir' ) ) {
		$uploads = wp_get_upload_dir();
	} else {
		$uploads = wp_upload_dir();
	}

	return $uploads;
}

/**
 * Check if override media thumbnail setting is ON or OFF.
 *
 * @since 1.1.0
 *
 * @param int|string $attachment_id ID of attachment.
 *
 * @return boolean TRUE if override is ON, FALSE is OFF
 */
function rtgodam_is_override_thumbnail( $attachment_id = '' ) {

	// Fetch EasyDAM settings directly.
	$easydam_settings = get_option( 'rtgodam-settings', array() );

	// Return the 'overwrite_thumbnails' value, defaulting to false if not set.
	$rtgodam_override_thumbnail = ! empty( $easydam_settings['video']['overwrite_thumbnails'] );

	/**
	 * Allow user to override the setting.
	 *
	 * @since 1.1.0
	 *
	 * @param boolean   $rtgodam_override_thumbnail     Number of thumbnails set in setting.
	 * @param int       $attachment_id              ID of attachment.
	 */
	$rtgodam_override_thumbnail = apply_filters( 'rtgodam_is_override_thumbnail', $rtgodam_override_thumbnail, $attachment_id );

	return $rtgodam_override_thumbnail;
}

/**
 * Get remote IP address
 *
 * @return string Remote IP address
 */
function rtgodam_get_remote_ip_address() {
	$client_ip = rtgodam_get_server_var( 'HTTP_CLIENT_IP' );
	$xff       = rtgodam_get_server_var( 'HTTP_X_FORWARDED_FOR' );
	if ( ! empty( $client_ip ) ) {
		return $client_ip;
	} elseif ( ! empty( $xff ) ) {
		return $xff;
	}

	$remote_addr = rtgodam_get_server_var( 'REMOTE_ADDR' );
	return $remote_addr;
}

/**
 * Set status column head in media admin page
 *
 * @since 1.2
 *
 * @param array $defaults columns list.
 *
 * @return array columns list
 */
function rtgodam_add_status_columns_head( $defaults ) {

	$defaults['convert_status'] = __( 'Transcode Status', 'godam' );
	return $defaults;
}

/**
 * Set status column content in media admin page
 *
 * @since 1.2
 *
 * @param string $column_name column name.
 * @param int    $post_id Post ID.
 */
function rtgodam_add_status_columns_content( $column_name, $post_id ) {
	if ( 'convert_status' !== $column_name ) {
		return;
	}

	$transcoded_files  = get_post_meta( $post_id, 'rtgodam_media_transcoded_files', true );
	$transcoded_thumbs = get_post_meta( $post_id, 'rtgodam_media_thumbnails', true );

	if ( empty( $transcoded_files ) && rtgodam_is_file_being_transcoded( $post_id ) ) {
		$check_button_text = __( 'Check Status', 'godam' );

		/**
		 * Filters the text of transcoding process status check button.
		 *
		 * @since 1.2
		 *
		 * @param string $check_button_text Default text of transcoding process status check button.
		 */
		$check_button_text = apply_filters( 'rtgodam_check_status_button_text', $check_button_text );

		?>
		<div id="span_status<?php echo esc_attr( $post_id ); ?>"></div>
		<button type="button" id="btn_check_status<?php echo esc_attr( $post_id ); ?>" name="check_status_btn" data-value='<?php echo esc_attr( $post_id ); ?>'><?php echo esc_html( $check_button_text ); ?></button>
		<?php

	} elseif ( ! empty( $transcoded_files ) && ! empty( $transcoded_thumbs ) ) {
		echo esc_html__( 'File is transcoded.', 'godam' );
	}
}

$user_data = rtgodam_get_user_data();
$is_license_verified = isset( $user_data['valid_license'] ) ? $user_data['valid_license'] : false;

if ( $is_license_verified ) {
	add_filter( 'manage_media_columns', 'rtgodam_add_status_columns_head' );
	add_action( 'manage_media_custom_column', 'rtgodam_add_status_columns_content', 10, 2 );
}

/**
 * Set sortable status column in media admin page
 *
 * @since 1.2
 *
 * @param array $columns columns list.
 *
 * @return array columns list
 */
function rtgodam_status_column_register_sortable( $columns ) {

	$columns['convert_status'] = 'convert_status';
	return $columns;
}

add_filter( 'manage_upload_sortable_columns', 'rtgodam_status_column_register_sortable' );

/**
 * Method to add js function.
 *
 * @since 1.2
 */
function rtgodam_enqueue_scripts() {

	if ( current_user_can( 'manage_options' ) ) {

		if ( ! is_admin() ) {
			wp_enqueue_style( 'rt-transcoder-client-style', plugins_url( 'css/rt-transcoder-client.min.css', __FILE__ ), array(), RTGODAM_VERSION );
		}
	}
}

if ( rtgodam_is_track_status_enabled() ) {
	add_action( 'wp_enqueue_scripts', 'rtgodam_enqueue_scripts' );
}
add_action( 'admin_enqueue_scripts', 'rtgodam_enqueue_scripts' );

/**
 * Enqueues script on frontend.
 *
 * @return void
 */
function rtgodam_enqueue_frontend_scripts() {
	$file_to_use = 'public-assets/js/build/transcoder.min.js';

	$file = path_join( RTGODAM_PATH, $file_to_use );
	if ( file_exists( $file ) && class_exists( 'RTMedia' ) ) {
		wp_enqueue_script( 'rt-transcoder-front-js', RTGODAM_URL . $file_to_use, array( 'jquery', 'rtmedia-backbone' ), filemtime( $file ), true );

		$rest_url_prefix = get_site_url() . '/' . rest_get_url_prefix();
		wp_localize_script( 'rt-transcoder-front-js', 'rtTranscoder', array( 'restURLPrefix' => $rest_url_prefix ) );
	}
}

add_action( 'wp_enqueue_scripts', 'rtgodam_enqueue_frontend_scripts' );


/**
 * Method to handle AJAX request for checking status.
 *
 * @since 1.2
 */
function rtgodam_ajax_process_check_status_request() {

	check_ajax_referer( 'check-transcoding-status-ajax-nonce', 'security', true );
	$post_id = rtgodam_filter_input( INPUT_POST, 'postid', FILTER_SANITIZE_NUMBER_INT );

	if ( ! empty( $post_id ) ) {
		echo esc_html( rtgodam_get_transcoding_status( $post_id ) );
	}

	wp_die();
}

// Action added to handle check_status onclick request.
add_action( 'wp_ajax_checkstatus', 'rtgodam_ajax_process_check_status_request' );

/**
 * To get status of transcoding process
 *
 * @since 1.2
 *
 * @param int $post_id post ID.
 *
 * @return string transcoding process status
 */
function rtgodam_get_transcoding_status( $post_id ) {

	require_once RTGODAM_PATH . 'admin/godam-transcoder-handler.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant

	$obj    = new RTGODAM_Transcoder_Handler( true );
	$status = $obj->get_transcoding_status( $post_id );

	return $status;
}

/**
 * To get status of transcoding process
 *
 * @since 1.2
 *
 * @param int $rtmedia_id rtmedia ID.
 */
function rtgodam_add_transcoding_process_status_button_single_media_page( $rtmedia_id ) {

	global $wpdb;
	$rtmedia_media_table = $wpdb->prefix . 'rtgodam_rtm_media';

	$post_id = wp_cache_get( 'media_' . $rtmedia_id, 'godam' );
	if ( empty( $post_id ) ) {
		$results = $wpdb->get_results( $wpdb->prepare( "SELECT media_id FROM $rtmedia_media_table WHERE id = %d", $rtmedia_id ), OBJECT ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- %s adds '' around table name.
		$post_id = $results[0]->media_id;
		wp_cache_set( 'media_' . $rtmedia_id, $post_id, 'godam', 3600 );
	}

	$check_button_text = __( 'Check Status', 'godam' );

	/**
	 * Filters the text of transcoding process status check button.
	 *
	 * @since 1.2
	 *
	 * @param string $check_button_text Default text of transcoding process status check button.
	 */
	$check_button_text = apply_filters( 'rtgodam_transcoder_check_status_button_text', $check_button_text );

	if ( rtgodam_is_file_being_transcoded( $post_id ) ) {

		if ( current_user_can( 'manage_options' ) && rtgodam_is_track_status_enabled() ) {
			$message = sprintf(
				'<div class="transcoding-in-progress"><button id="btn_check_status%1$s" class="btn_check_transcode_status" name="check_status_btn" data-value="%1$s">%2$s</button> <div class="transcode_status_box" id="span_status%1$s">%3$s</div></div>',
				esc_attr( $post_id ),
				esc_html( $check_button_text ),
				esc_html__( 'This file is converting. Please click on check status button to know current status or refresh the page after some time. ', 'godam' )
			);
		} else {
			$message = sprintf(
				'<p class="transcoding-in-progress">%s</p>',
				esc_html__( 'This file is converting. Please refresh the page after some time.', 'godam' )
			);
		}

		echo wp_kses_post( $message );
	}
}

// Add action to media single page.
add_action( 'rtmedia_actions_before_description', 'rtgodam_add_transcoding_process_status_button_single_media_page', 10, 1 );

/**
 * To resize video container of media single page when video is being transcoded .
 *
 * @since 1.2
 *
 * @param string $html html markup.
 * @param object $rtmedia_media rtmedia media object.
 *
 * @return string html markup
 */
function rtgodam_filter_single_media_page_video_markup( $html, $rtmedia_media ) {
	if ( empty( $rtmedia_media ) || empty( $rtmedia_media->media_type ) || empty( $rtmedia_media->media_id ) ) {
		return $html;
	}
	if ( 'video' === $rtmedia_media->media_type && rtgodam_is_file_being_transcoded( $rtmedia_media->media_id ) ) {

		$youtube_url = get_rtmedia_meta( $rtmedia_media->id, 'video_url_uploaded_from' );
		$html        = "<div id='rtm-mejs-video-container'>";

		if ( empty( $youtube_url ) ) {

			$html_video = '<video poster="%s" src="%s" type="video/mp4" class="wp-video-shortcode" id="rtgodam_media_video_%s" controls="controls" preload="metadata"></video>';
			$html      .= sprintf( $html_video, esc_url( $rtmedia_media->cover_art ), esc_url( wp_get_attachment_url( $rtmedia_media->media_id ) ), esc_attr( $rtmedia_media->id ) );

		} else {

			$html_video = '<video width="640" height="360" class="url-video" id="video-id-%s" preload="none"><source type="video/youtube" src="%s" /></video>';
			$html      .= sprintf( $html_video, esc_attr( $rtmedia_media->id ), esc_url( wp_get_attachment_url( $rtmedia_media->media_id ) ) );

		}

		$html .= '</div>';
	}
	return $html;
}

add_filter( 'rtmedia_single_content_filter', 'rtgodam_filter_single_media_page_video_markup', 10, 2 );

/**
 *
 * Added handler to update usage if it is not updated.
 * Added one flag in transient to avoid requests when usage quota is over and it is not renewed.
 *
 * @since 1.0.0
 *
 * @param array  $wp_metadata       Metadata of the attachment.
 * @param int    $attachment_id  ID of attachment.
 * @param string $autoformat     If true then generating thumbs only else trancode video.
 */
function rtgodam_media_update_usage( $wp_metadata, $attachment_id, $autoformat = true ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed

	$stored_key     = get_site_option( 'rtgodam-api-key' );
	$transient_flag = get_transient( 'rtgodam_usage_update_flag' );

	if ( ! empty( $stored_key ) && empty( $transient_flag ) ) {

		$usage_info = get_site_option( 'rtgodam-usage' );
		$handler    = new RTGODAM_Transcoder_Handler( false );

		if ( empty( $usage_info ) || empty( $usage_info[ $handler->api_key ]->remaining ) ) {

			$handler->update_usage( $handler->api_key );
			set_transient( 'rtgodam_usage_update_flag', '1', HOUR_IN_SECONDS );
		}
	}

	return $wp_metadata;
}

add_filter( 'wp_generate_attachment_metadata', 'rtgodam_media_update_usage', 10, 2 );

/**
 * To get sanitized server variables.
 *
 * @param string $server_key Key of the $_SERVER superglobal variable.
 * @param int    $filter_type The ID of the filter to apply.
 *
 * @return string Filtered value if supports.
 */
function rtgodam_get_server_var( $server_key, $filter_type = FILTER_SANITIZE_FULL_SPECIAL_CHARS ) {
	$server_val = '';
	if ( function_exists( 'filter_input' ) && filter_has_var( INPUT_SERVER, $server_key ) ) {
		$server_val = rtgodam_filter_input( INPUT_SERVER, $server_key, $filter_type );
	} elseif ( isset( $_SERVER[ $server_key ] ) ) {
		$server_val = $_SERVER[ $server_key ]; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	}
	return $server_val;
}

/**
 * Get local ip addresses for block.
 *
 * @return array
 */
function rtgodam_get_blacklist_ip_addresses() {
	// If custom API URL added then don't block local ips.
	if ( defined( 'RTGODAM_TRANSCODER_API_URL' ) ) {
		return array();
	}

	return array( '127.0.0.1', '::1' );
}

/**
 * Helper function to verify the license key.
 *
 * @param string $license_key The license key to verify.
 * @return array|WP_Error Array with status and data on success, WP_Error on failure.
 */
function rtgodam_verify_license( $license_key, $save = false ) {
	if ( empty( $license_key ) ) {
		return new \WP_Error( 'missing_license_key', 'License key is required.', array( 'status' => 400 ) );
	}

	$api_url = RTGODAM_API_BASE . '/api/method/godam_core.api.verification.verify_license';

	// Prepare request body.
	$site_url     = get_site_url();
	$request_body = array(
		'license_key' => $license_key,
		'site_url'    => $site_url,
	);

	$args = array(
		'body'    => json_encode( $request_body ),
		'headers' => array(
			'Content-Type' => 'application/json',
		),
		'timeout' => 10,
	);

	// Use vip_safe_wp_remote_post as primary and wp_safe_remote_post as fallback.
	if ( function_exists( 'vip_safe_wp_remote_post' ) ) {
		$response = vip_safe_wp_remote_post( $api_url, $args, 3, 3 );
	} else {
		$response = wp_safe_remote_post( $api_url, $args );
	}

	if ( is_wp_error( $response ) ) {
		return new \WP_Error( 'api_error', 'An error occurred while verifying the license. Please try again.', array( 'status' => 500 ) );
	}

	$status_code = wp_remote_retrieve_response_code( $response );
	$body        = json_decode( wp_remote_retrieve_body( $response ), true );

	if ( isset( $body['message']['error'] ) ) {
		return new \WP_Error( 'invalid_license', $body['message']['error'], array( 'status' => 400 ) );
	}

	// Handle success response.
	if ( 200 === $status_code && isset( $body['message']['account_token'] ) ) {

		$account_token = $body['message']['account_token'];
		if ( $save ) {
			// Save the license key in the site options only if it is verified.
			update_site_option( 'rtgodam-api-key', $license_key );
			update_site_option( 'rtgodam-api-key-stored', $license_key );
			update_site_option( 'rtgodam-account-token', $account_token );

			// Update usage data.
			$handler = new \RTGODAM_Transcoder_Handler( false );
			$handler->update_usage( $license_key );
		}

		return array(
			'status'  => 'success',
			'message' => 'License key verified and stored successfully!',
			'data'    => $body['message'],
		);
	}

	// Handle failure response.
	if ( 404 === $status_code ) {
		return new \WP_Error( 'invalid_license', 'Invalid license key. Please try again.', array( 'status' => 404 ) );
	}

	// Handle unexpected responses.
	return new \WP_Error( 'unexpected_error', 'An unexpected error occurred. Please try again later.', array( 'status' => 500 ) );
}

/**
 * Mask string.
 *
 * @param string $input  Input string.
 * @param int    $offset Offset.
 *
 * @return string
 */
function rtgodam_mask_string( $input, $offset = 4 ) {
	$length = strlen( $input );
	if ( $length <= $offset ) {
		return $input; // If string length is equal or less than $offset, return as is.
	}

	$masked = str_repeat( '*', $length - $offset ) . substr( $input, -$offset );
	return $masked;
}

/**
 * Get the List of Categories for the post.
 *
 * @param int $post_id Current Post Id.
 *
 * @return void
 */
function rtgodam_get_categories_list( $post_id ) {

	$categories     = get_the_category( $post_id );
	$category_names = array();

	if ( is_array( $categories ) && ! empty( $categories ) ) {

		foreach ( $categories as $category ) {
			$category_names[] = $category->name;
		}

		$comma_separated = implode( ', ', $category_names );

		return $comma_separated;
	}

	return '';
}

/**
 * Get the List of Categories for the post.
 *
 * @param int $post_id Current Post Id.
 *
 * @return void
 */
function rtgodam_get_tags_list( $post_id ) {

	$tags      = get_the_tags( $post_id );
	$tag_names = array();

	if ( ! is_array( $tags ) && ! empty( $tags ) ) {

		foreach ( $tags as $tag ) {
			$tag_names[] = $tag->name;
		}

		$comma_separated = implode( ', ', $tag_names );
		return $comma_separated;
	}

	return '';
}

/**
 * Utility function to get the array to localize.
 *
 * @return array The array to localize
 */
function rtgodam_get_localize_array() {

	$localize_array = array();

	$localize_array['endpoint']   = RTGODAM_ANALYTICS_BASE;
	$localize_array['isPost']     = empty( is_single() ) ? 0 : is_single();
	$localize_array['isPage']     = empty( is_page() ) ? 0 : is_page();
	$localize_array['isArchive']  = empty( is_archive() ) ? 0 : is_archive();
	$localize_array['postTitle']  = get_the_title();
	$localize_array['locationIP'] = rtgodam_get_user_ip();

	/**
	 * Get Current User.
	 */
	$current_user = wp_get_current_user();
	$email_id     = '';

	$localize_array['userId'] = $current_user->ID;

	if ( ! empty( (array) $current_user->data ) ) {

		$email_id                  = $current_user->data->user_email;
		$localize_array['emailId'] = $email_id;
	}

	$localize_array['siteId'] = get_current_blog_id();

	if ( get_post_type() ) {

		$localize_array['postType'] = get_post_type();
	}

	$post_id = get_the_ID();

	if ( $post_id ) {

		$localize_array['postId']     = $post_id;
		$localize_array['categories'] = rtgodam_get_categories_list( $post_id );
		$localize_array['tags']       = rtgodam_get_tags_list( $post_id );

	}

	if ( null !== get_the_author() ) {

		$localize_array['author'] = get_the_author();
	}

	$localize_array['token'] = get_site_option( 'rtgodam-account-token', 'unverified' );

	return $localize_array;
}

/**
 * Get the user's IP address.
 *
 * @return string The user's IP address.
 */
function rtgodam_get_user_ip() {
	$ip_address = '';

	$ip_address = filter_var( rtgodam_get_server_var( 'HTTP_CLIENT_IP' ), FILTER_VALIDATE_IP );

	if ( empty( $ip_address ) ) {
		$forwarded_for = rtgodam_get_server_var( 'HTTP_X_FORWARDED_FOR' );
		$ip_address = ! empty( $forwarded_for ) ? filter_var( explode( ',', $forwarded_for )[0], FILTER_VALIDATE_IP ) : false;
	}

	if ( empty( $ip_address ) ) {
		$ip_address = filter_var( rtgodam_get_server_var( 'REMOTE_ADDR' ), FILTER_VALIDATE_IP );
	}

	return $ip_address; // Return an empty string if invalid
}
