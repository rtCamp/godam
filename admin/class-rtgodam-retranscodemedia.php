<?php
/**
 * Retranscode media https://wordpress.org/plugins/regenerate-thumbnails/
 * The code and UI is borrowed from the following plugin (Author: Alex Mills).
 *
 * @package GoDAM
 */

defined( 'ABSPATH' ) || exit;


/**
 * Media retranscode module.
 */
class RTGODAM_RetranscodeMedia {
	/**
	 * ID of the menu.
	 *
	 *  @var string
	 */
	public $menu_id;

	/**
	 * API key of transcoder subscription.
	 *
	 *  @var string
	 */
	public $api_key;

	/**
	 * Stored API key of transcoder subscription.
	 *
	 *  @var string
	 */
	public $stored_api_key;


	/**
	 * Usage info of transcoder subscription.
	 *
	 *  @var array
	 */
	public $usage_info;

	/**
	 * Capability required to use this feature.
	 *
	 * @var string
	 */
	public $capability;

	/**
	 * Functinallity initialization
	 */
	public function __construct() {

		$this->api_key        = get_option( 'rtgodam-api-key' );
		$this->stored_api_key = get_option( 'rtgodam-api-key-stored' );

		if ( ! rtgodam_is_api_key_valid() ) {
			return; // Abort initializing retranscoding if api is invalid.
		}

		$this->usage_info = get_option( 'rtgodam-usage' );
		// Load Rest Endpoints.
		$this->load_rest_endpoints();

		// Do not activate re-transcoding without valid api key
		// Or usage are fully utilized.
		if ( empty( $this->api_key ) ) {
			return;
		}
		if ( isset( $this->usage_info ) && is_array( $this->usage_info ) && array_key_exists( $this->api_key, $this->usage_info ) ) {
			if ( is_object( $this->usage_info[ $this->api_key ] ) && isset( $this->usage_info[ $this->api_key ]->status ) && $this->usage_info[ $this->api_key ]->status ) {
				if ( isset( $this->usage_info[ $this->api_key ]->remaining ) && $this->usage_info[ $this->api_key ]->remaining <= 0 ) {
					return;
				}
			}
		} else {
			return;
		}

		add_action( 'admin_enqueue_scripts', array( $this, 'admin_enqueues' ) );
		add_filter( 'media_row_actions', array( $this, 'add_media_row_action' ), 10, 2 );
		add_action( 'admin_head-upload.php', array( $this, 'add_bulk_actions_via_javascript' ) );
		add_action( 'admin_action_bulk_retranscode_media', array( $this, 'bulk_action_handler' ) ); // Top drowndown.
		add_action( 'admin_action_-1', array( $this, 'bulk_action_handler' ) ); // Bottom dropdown (assumes top dropdown = default value).
		add_action( 'rtgodam_before_thumbnail_store', array( $this, 'rtgodam_before_thumbnail_store' ), 10, 2 ); // Delete old thumbs.
		add_action( 'rtgodam_before_transcoded_media_store', array( $this, 'rtgodam_before_transcoded_media_store' ), 10, 2 ); // Delete old transcoded files.
		add_action( 'rtgodam_transcoded_thumbnails_added', array( $this, 'transcoded_thumbnails_added' ), 10, 1 ); // Add the current thumbnail to the newly added thumbnails.
		add_action( 'rtgodam_handle_callback_finished', array( $this, 'rtgodam_handle_callback_finished' ), 10, 2 ); // Clean the extra meta that has been added while sending retranscoding request.

		// Allow people to change what capability is required to use this feature.
		$this->capability = apply_filters( 'rtgodam_retranscode_media_cap', 'manage_options' );
	}

	/**
	 * Function to load rest api endpoints.
	 *
	 * @return void
	 */
	public function load_rest_endpoints() {
		include_once RTGODAM_PATH . 'admin/class-rtgodam-transcoder-rest-routes.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant

		// Create class object and register routes.
		$transcoder_rest_routes = new RTGODAM_Transcoder_Rest_Routes();
		add_action( 'rest_api_init', array( $transcoder_rest_routes, 'register_routes' ) );
	}

	/**
	 * Add the Retranscode Media meta box to the EasyDam Tools page.
	 */
	public function render_tools_page() {
		$this->add_easydam_meta_boxes()
		?>
		<div>
			<h1><?php esc_html_e( 'GoDAM Tools', 'godam' ); ?></h1>
			<div id="easydam-tools-widget">
				<?php
				do_meta_boxes( 'rtgodam_tools', 'normal', null );
				?>
			</div>
		</div>
		<?php
	}

	/**
	 * Register the meta box for the EasyDam Tools page.
	 */
	public function add_easydam_meta_boxes() {

		add_meta_box(
			'retranscode_media_widget',
			__( 'Retranscode Media', 'godam' ),
			array( $this, 'retranscode_interface' ),
			'rtgodam_tools',
			'normal',
			'high'
		);
	}

	/**
	 * Enqueue the needed Javascript and CSS
	 *
	 * @param string $hook_suffix Suffix of the hook.
	 *
	 * @return void
	 */
	public function admin_enqueues( $hook_suffix ) {
		if ( $hook_suffix !== $this->menu_id ) {
			return;
		}

		wp_enqueue_script( 'jquery-ui-progressbar', plugins_url( 'js/jquery.ui.progressbar.min.js', __FILE__ ), array( 'jquery-ui-core', 'jquery-ui-widget' ), '1.8.6', true );
		wp_enqueue_style( 'jquery-ui-retranscodemedia', plugins_url( 'css/jquery-ui-1.7.2.custom.css', __FILE__ ), array(), '1.7.2' );

		$ids = array();
		if ( ! empty( $_POST['rtgodam_tools'] ) || ! empty( $_REQUEST['ids'] ) ) {
			// Capability check.
			if ( ! current_user_can( $this->capability ) ) {
				wp_die( esc_html__( 'Cheatin&#8217; uh?', 'godam' ) );
			}

			// Form nonce check.
			check_admin_referer( 'rtgodam_tools' );

			$file_size = 0;
			$files     = array();

			// Get the list of media IDs.
			$ids = rtgodam_filter_input( INPUT_GET, 'ids', FILTER_SANITIZE_FULL_SPECIAL_CHARS );

			if ( ! empty( $ids ) ) {
				$ids = explode( ',', $ids );
			} else {
				add_filter( 'posts_where', array( $this, 'add_search_mime_types' ) );
				$query = new WP_Query( array( 'post_type' => 'attachments' ) );
				$media = $query->get_posts();
				remove_filter( 'posts_where', array( $this, 'add_search_mime_types' ) );
				if ( empty( $media ) || is_wp_error( $media ) ) {

					// translators: Link to the media page.
					echo '	<p>' . sprintf( esc_html__( "Unable to find any media. Are you sure <a href='%s'>some exist</a>?", 'godam' ), esc_url( admin_url( 'upload.php' ) ) ) . '</p></div>';
					return;
				}

				// Generate the list of IDs.
				$ids = array();
				foreach ( $media as $i => $each ) {
					$ids[] = $each->ID;
					$path  = get_attached_file( $each->ID );
					if ( file_exists( $path ) ) {
						$current_file_size  = filesize( $path );
						$file_size          = $file_size + $current_file_size;
						$files[ $each->ID ] = array(
							'name' => esc_html( get_the_title( $each->ID ) ),
							'size' => $current_file_size,
						);
					}
				}
			}

			$stopping_text = esc_html__( 'Stopping...', 'godam' );
			$previous_url  = wp_get_referer();
			// translators: The URL to go back to the previous page.
			$text_goback = $previous_url ? sprintf( __( 'To go back to the previous page, <a href="%s">click here</a>.', 'godam' ), esc_url( $previous_url ) ) : '';
			$admin_url   = esc_url( wp_nonce_url( admin_url( 'admin.php?page=rtgodam_tools&goback=1' ), 'rtgodam_tools' ) . '&ids=' );

			wp_register_script(
				'rtgodam-retranscode-admin',
				RTGODAM_URL . '/admin/js/godam-retranscode-admin.js',
				array( 'jquery' ),
				filemtime( RTGODAM_PATH . '/admin/js/godam-retranscode-admin.js' ),
				true
			);

			wp_localize_script(
				'rtgodam-retranscode-admin',
				'rtgodamRetranscode',
				array(
					'ids'          => $ids,
					'stoppingText' => $stopping_text,
					'textGoback'   => $text_goback,
					'adminUrl'     => $admin_url,
				)
			);

			wp_enqueue_script( 'rtgodam-retranscode-admin' );
		}
	}

	/**
	 * Add a "Re Transcode Media" link to the media row actions
	 *
	 * @param array   $actions   An array of action links for each attachment.
	 *                           Default 'Edit', 'Delete Permanently', 'View'.
	 * @param WP_Post $post      WP_Post object for the current attachment.
	 *
	 * @return array
	 */
	public function add_media_row_action( $actions, $post ) {

		if ( (
				'audio/' !== substr( $post->post_mime_type, 0, 6 ) &&
				'video/' !== substr( $post->post_mime_type, 0, 6 ) &&
				'application/pdf' !== $post->post_mime_type
			) ||
			// Safe fallback via filter; PHPCS can't resolve dynamic capability.
			// phpcs:ignore WordPress.WP.Capabilities.Undetermined
			! current_user_can( $this->capability )
		) {
			return $actions;
		}

		$actions = ( ! empty( $actions ) && is_array( $actions ) ) ? $actions : array();

		$url = wp_nonce_url( admin_url( 'admin.php?page=rtgodam_tools&goback=1&ids=' . $post->ID ), 'rtgodam_tools' );

		$actions['retranscode_media'] = sprintf(
			'<a href="%s" title="%s">%s</a>',
			esc_url( $url ),
			esc_attr__( 'Retranscode this single media', 'godam' ),
			__( 'Retranscode Media', 'godam' )
		);

		return $actions;
	}

	/**
	 * Add "Re Transcode Media" to the Bulk Actions media dropdown
	 *
	 * @param array $actions Actions to perform.
	 *
	 * @return array
	 */
	public function add_bulk_actions( $actions ) {

		$delete = false;
		if ( ! empty( $actions['delete'] ) ) {
			$delete = $actions['delete'];
			unset( $actions['delete'] );
		}

		$actions['bulk_retranscode_media'] = __( 'Retranscode Media', 'godam' );

		if ( $delete ) {
			$actions['delete'] = $delete;
		}

		return $actions;
	}

	/**
	 * Add new items to the Bulk Actions using Javascript
	 */
	public function add_bulk_actions_via_javascript() {
		if ( ! current_user_can( $this->capability ) ) {
			return;
		}

		wp_enqueue_script(
			'rtgodam-retranscode-media',
			RTGODAM_URL . '/admin/js/godam-retranscode-media.js',
			array( 'jquery' ),
			filemtime( RTGODAM_PATH . '/admin/js/godam-retranscode-media.js' ),
			true
		);
	}

	/**
	 * Handles the bulk actions POST
	 *
	 * @return void
	 */
	public function bulk_action_handler() {
		$action  = rtgodam_filter_input( INPUT_GET, 'action', FILTER_SANITIZE_FULL_SPECIAL_CHARS );
		$action2 = rtgodam_filter_input( INPUT_GET, 'action2', FILTER_SANITIZE_FULL_SPECIAL_CHARS );
		$media   = rtgodam_filter_input( INPUT_GET, 'media', FILTER_SANITIZE_NUMBER_INT, FILTER_REQUIRE_ARRAY );

		if ( empty( $action ) || empty( $media ) || ! is_array( $media ) ||
			( 'bulk_retranscode_media' !== $action && 'bulk_retranscode_media' !== $action2 )
		) {
			return;
		}

		if ( empty( $media ) || ! is_array( $media ) ) {
			return;
		}

		check_admin_referer( 'bulk-media' );

		$ids = implode( ',', $media );

		// Can't use wp_nonce_url() as it escapes HTML entities.
		$redirect_url = add_query_arg(
			'_wpnonce',
			wp_create_nonce( 'rtgodam_tools' ),
			get_admin_url( get_current_blog_id(), 'admin.php?page=rtgodam_tools&goback=1&media_ids=' . $ids )
		);

		wp_safe_redirect( $redirect_url );
		exit();
	}

	/**
	 * The user interface
	 */
	public function retranscode_interface() {
		?>

		<div id="message" class="updated fade" style="display:none"></div>

		<div class="wrap retranscodemedia">

			<?php

			// If the button was clicked.
			if ( ! empty( $_POST['rtgodam_tools'] ) || ! empty( $_REQUEST['ids'] ) ) {
				// Capability check.
				if ( ! current_user_can( $this->capability ) ) {
					wp_die( esc_html__( 'Cheatin&#8217; uh?', 'godam' ) );
				}

				// Form nonce check.
				check_admin_referer( 'rtgodam_tools' );

				$file_size = 0;
				$files     = array();

				// Create the list of image IDs.
				$usage_info = get_option( 'rtgodam-usage' );
				$ids        = rtgodam_filter_input( INPUT_GET, 'ids', FILTER_SANITIZE_FULL_SPECIAL_CHARS );
				if ( ! empty( $ids ) ) {
					$media = array_map( 'intval', explode( ',', trim( $ids, ',' ) ) );
					$ids   = implode( ',', $media );
					foreach ( $media as $key => $each ) {
						$path = get_attached_file( $each );
						if ( file_exists( $path ) ) {
							$current_file_size = filesize( $path );
							$file_size         = $file_size + $current_file_size;
							$files[ $each ]    = array(
								'name' => esc_html( get_the_title( $each ) ),
								'size' => $current_file_size,
							);
						}
					}
				} else {
					add_filter( 'posts_where', array( $this, 'add_search_mime_types' ) );
					$query = new WP_Query( array( 'post_type' => 'attachments' ) );
					$media = $query->get_posts();
					remove_filter( 'posts_where', array( $this, 'add_search_mime_types' ) );
					if ( empty( $media ) || is_wp_error( $media ) ) {

						// translators: Link to the media page.
						echo '	<p>' . sprintf( esc_html__( "Unable to find any media. Are you sure <a href='%s'>some exist</a>?", 'godam' ), esc_url( admin_url( 'upload.php' ) ) ) . '</p></div>';
						return;
					}

					// Generate the list of IDs.
					$ids = array();
					foreach ( $media as $i => $each ) {
						$ids[] = $each->ID;
						$path  = get_attached_file( $each->ID );
						if ( file_exists( $path ) ) {
							$current_file_size  = filesize( $path );
							$file_size          = $file_size + $current_file_size;
							$files[ $each->ID ] = array(
								'name' => esc_html( get_the_title( $each->ID ) ),
								'size' => $current_file_size,
							);
						}
					}
					$ids = implode( ',', $ids );
				}

				if ( empty( $ids ) ) {
					echo '	<p>' . esc_html__( 'There are no media available to send for transcoding.', 'godam' ) . '</p>';
					return;
				}

				if ( isset( $usage_info ) && is_array( $usage_info ) && array_key_exists( $this->api_key, $usage_info ) ) {
					if ( is_object( $usage_info[ $this->api_key ] ) && isset( $usage_info[ $this->api_key ]->status ) && $usage_info[ $this->api_key ]->status ) {
						if ( isset( $usage_info[ $this->api_key ]->remaining ) && $usage_info[ $this->api_key ]->remaining > 0 ) {
							if ( $usage_info[ $this->api_key ]->remaining < $file_size ) {
								$this->retranscode_admin_error_notice();
								// User doesn't have enough bandwidth remaining for re-transcoding.
								echo '	<p>' . esc_html__( 'You do not have sufficient bandwidth remaining to perform the transcoding.', 'godam' ) . '</p>';
								echo '	<p><b>' . esc_html__( 'Your remaining bandwidth is : ', 'godam' ) . esc_html( size_format( $usage_info[ $this->api_key ]->remaining, 2 ) ) . '</b></p>';
								echo '	<p><b>' . esc_html__( 'Required bandwidth is: ', 'godam' ) . esc_html( size_format( $file_size, 2 ) ) . '</b></p></div>';
								if ( $usage_info[ $this->api_key ]->remaining > 0 ) {
									if ( is_array( $files ) && count( $files ) > 0 ) {
										?>
										<div><p><?php esc_html_e( 'You can select the files manually and try again.', 'godam' ); ?></p>
										<form method="POST" action="<?php esc_url( admin_url( 'admin.php' ) ); ?>">
										<?php wp_nonce_field( 'rtgodam_tools' ); ?>
										<input type="hidden" name="page" value="rtgodam_tools">
										<table border=0>
										?>
											<tr>
												<td><input type="submit" class="button button-primary button-small" value="<?php esc_attr_e( 'Proceed with retranscoding', 'godam' ); ?>"></td>
												<td></td>
											</tr>
										<?php
										foreach ( $files as $key => $value ) {
											?>
											<tr>
												<td><label><input type="checkbox" name="ids[]" value="<?php echo esc_attr( $key ); ?>" /> <?php echo esc_html( $value['name'] ); ?> (ID <?php echo esc_html( $key ); ?>) </label></td>
												<td><?php echo esc_html( size_format( $value['size'], 2 ) ); ?></td>
											</tr>
											<?php
										}
										?>
											<tr>
												<td><input type="submit" class="button button-primary button-small" value="<?php esc_attr_e( 'Proceed with retranscoding', 'godam' ); ?>" ></td>
												<td></td>
											</tr>
										</table>
										</form></div>
										<?php
									}
								}
								return;
							}
						}
					}
				}
				?>
				<p><?php esc_html_e( 'Your files are being re-transcoded. Do not navigate away from this page until the process is completed, as doing so will prematurely abort the script. Retranscoding can take a while, especially for larger files. You can view the progress below.', 'godam' ); ?></p>

				<?php
				$count = count( $media );

				$previous_url = wp_get_referer();
				// translators: The URL to go back to the previous page.
				$text_goback = $previous_url ? sprintf( __( 'To go back to the previous page, <a href="%s">click here</a>.', 'godam' ), esc_url( $previous_url ) ) : '';

				// translators: Count of media which were successfully and media which were failed transcoded with the time in seconds and previout page link.
				$text_failures = sprintf( __( 'All done! %1$s media file(s) were successfully sent for transcoding in %2$s seconds and there were %3$s failure(s). To try transcoding the failed media again, <a href="%4$s">click here</a>. %5$s', 'godam' ), "' + rtgodam_successes + '", "' + rtgodam_totaltime + '", "' + rtgodam_errors + '", esc_url( wp_nonce_url( admin_url( 'admin.php?page=rtgodam_tools&goback=1' ), 'rtgodam_tools' ) . '&ids=' ) . "' + rtgodam_failedlist + '", $text_goback );
				// translators: Count of media which were successfully transcoded with the time in seconds and previout page link.
				$text_nofailures = sprintf( __( 'All done! %1$s media file(s) were successfully sent for transcoding in %2$s seconds and there were 0 failures. %3$s', 'godam' ), "' + rtgodam_successes + '", "' + rtgodam_totaltime + '", $text_goback );
				?>

				<noscript><p><em><?php esc_html_e( 'You must enable Javascript in order to proceed!', 'godam' ); ?></em></p></noscript>

				<div id="retranscodemedia-bar" style="position:relative;height:25px;">
					<div id="retranscodemedia-bar-percent" style="position:absolute;left:50%;top:50%;width:300px;margin-left:-150px;height:25px;margin-top:-9px;font-weight:bold;text-align:center;"></div>
				</div>

				<p><input type="button" class="button hide-if-no-js" name="retranscodemedia-stop" id="retranscodemedia-stop" value="<?php esc_attr_e( 'Abort the Operation', 'godam' ); ?>" /></p>

				<h3 class="title"><?php esc_html_e( 'Debugging Information', 'godam' ); ?></h3>

				<p>
						<?php
						// translators: Total count of the media.
						printf( esc_html__( 'Total Media: %s', 'godam' ), esc_html( $count ) );
						?>
						<br />
						<?php
						// translators: Count of media which were successfully sent to the transcoder server.
						printf( esc_html__( 'Media Sent for Retranscoding: %s', 'godam' ), '<span id="retranscodemedia-debug-successcount">0</span>' );
						?>
						<br />
						<?php
						// translators: Count of media which were failed while sending to the transcoder server.
						printf( esc_html__( 'Failed While Sending: %s', 'godam' ), '<span id="retranscodemedia-debug-failurecount">0</span>' );
						?>
				</p>

				<ol id="retranscodemedia-debuglist">
					<li style="display:none"></li>
				</ol>

				<?php
			} else {
				// No button click? Display the form.
				?>
				<form method="post" action="">
					<?php wp_nonce_field( 'rtgodam_tools' ); ?>

					<p><?php printf( esc_html__( 'This tool will retranscode ALL audio/video media uploaded to your website. This can be handy if you need to transcode media files uploaded in the past.', 'godam' ) ); ?>

					<i><?php printf( esc_html__( 'Sending your entire media library for retranscoding can consume a lot of your bandwidth allowance, so use this tool with care.', 'godam' ) ); ?></i></p>

					<p>
							<?php
							// translators: Placeholder is for admin media section link.
							printf( wp_kses( __( "You can retranscode specific media files (rather than ALL media) from the <a href='%s'>Media</a> page using Bulk Action via drop down or mouse hover a specific media (audio/video) file.", 'godam' ), array( 'a' => array( 'href' => array() ) ) ), esc_url( admin_url( 'upload.php' ) ) );
							?>
					</p>

					<p><?php esc_html_e( 'To begin, just press the button below.', 'godam' ); ?></p>

					<p><input type="submit" class="button hide-if-no-js button button-primary" name="rtgodam_tools" id="rtgodam_tools" value="<?php esc_attr_e( 'Retranscode All Media', 'godam' ); ?>" /></p>

					<noscript><p><em><?php esc_html_e( 'You must enable Javascript in order to proceed!', 'godam' ); ?></em></p></noscript>

				</form>
				<?php
			} // End if button
			?>
		</div>

		<?php
	}

	/**
	 * Helper to make a JSON error message
	 *
	 * @param int    $id ID of the attachment.
	 * @param string $message Error message.
	 */
	public function die_json_error_msg( $id, $message ) {
		// translators: Media name, Media ID and message for failed transcode.
		die( wp_json_encode( array( 'error' => sprintf( __( '&quot;%1$s&quot; (ID %2$s) failed to send. The error message was: %3$s', 'godam' ), esc_html( get_the_title( $id ) ), $id, $message ) ) ) );
	}

	/**
	 * Helper function to escape quotes in strings for use in Javascript
	 *
	 * @param string $str String to escape quotes from.
	 */
	public function esc_quotes( $str ) {
		return str_replace( '"', '\"', $str );
	}

	/**
	 * Display admin notice.
	 *
	 * @since   1.0.0
	 */
	private function retranscode_admin_error_notice() {
		?>
		<div class="error error-info retranscode-notice is-dismissible">
			<p>
				<?php esc_html_e( 'Insufficient bandwidth!', 'godam' ); ?>
			</p>
		</div>
		<?php
	}

	/**
	 * Delete the previously added media thumbnail files
	 *
	 * @param  number $media_id     Post ID of the media.
	 * @param  array  $post_request Post request coming for the transcoder API.
	 */
	public function rtgodam_before_thumbnail_store( $media_id = '', $post_request = '' ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed
		if ( empty( $media_id ) ) {
			return;
		}

		delete_post_meta( $media_id, 'rtgodam_media_thumbnails' );
	}

	/**
	 * Delete the previously transcoded media files
	 *
	 * @param  number $media_id     Post ID of the media.
	 * @param  array  $transcoded_files Post request coming for the transcoder API.
	 */
	public function rtgodam_before_transcoded_media_store( $media_id = '', $transcoded_files = '' ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed
		if ( empty( $media_id ) ) {
			return;
		}

		$current_files = get_post_meta( $media_id, 'rtgodam_media_transcoded_files', true );

		if ( ! empty( $current_files ) && is_array( $current_files ) ) {
			foreach ( $current_files as $files ) {
				if ( ! empty( $files ) && is_array( $files ) ) {
					rtgodam_delete_transcoded_files( $files );
				}
			}
		}
		delete_post_meta( $media_id, 'rtgodam_media_transcoded_files' );
	}

	/**
	 * Add the current thumbnail image in the newly added thumbnails if
	 * user wants to preserve the thumbnails set to the media
	 *
	 * @param  number $media_id     Post ID of the media.
	 */
	public function transcoded_thumbnails_added( $media_id = '' ) {
		if ( empty( $media_id ) ) {
			return;
		}

		$is_retranscoding_job = get_post_meta( $media_id, 'rtgodam_retranscoding_sent', true );

		$new_thumbs = get_post_meta( $media_id, 'rtgodam_media_thumbnails', true );
		$new_thumbs = is_array( $new_thumbs ) ? $new_thumbs : array();

		if ( $is_retranscoding_job && ! rtgodam_is_override_thumbnail() ) {
			$current_selected_thumb = get_post_meta( $media_id, 'rtgodam_media_video_thumbnail', true );

			if ( $current_selected_thumb && ! empty( $current_selected_thumb ) && ! in_array( $current_selected_thumb, $new_thumbs, true ) ) {
				$new_thumbs[] = $current_selected_thumb;
				update_post_meta( $media_id, 'rtgodam_media_thumbnails', $new_thumbs );
			}
		} else {
			if ( ! empty( $new_thumbs ) ) {
				update_post_meta( $media_id, 'rtgodam_media_video_thumbnail', $new_thumbs[0] );
			}

			$primary_remote_thumbnail_url = get_post_meta( $media_id, 'rtgodam_media_video_thumbnail', true );

			if ( ! empty( $primary_remote_thumbnail_url ) ) {
				do_action( 'rtgodam_primary_remote_thumbnail_set', $media_id, $primary_remote_thumbnail_url );
			}
		}
	}

	/**
	 * Callback request from the transcoder has been processed, so delete the flags
	 * which are not necessary after processing the callback request
	 *
	 * @param  number $attachment_id      Post ID of the media.
	 * @param  string $job_id             Unique job ID of the transcoding request.
	 */
	public function rtgodam_handle_callback_finished( $attachment_id = '', $job_id = '' ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed
		if ( empty( $attachment_id ) ) {
			return;
		}

		$is_retranscoding_job = get_post_meta( $attachment_id, 'rtgodam_retranscoding_sent', true );

		if ( $is_retranscoding_job ) {

			delete_post_meta( $attachment_id, 'rtgodam_retranscoding_sent' );

		}
	}

	/**
	 * WHERE search query to check attachment mime-type.
	 *
	 * @param string $where The WHERE clause of the query.
	 *
	 * @return string The WHERE clause of the query.
	 */
	public function add_search_mime_types( $where ) {
		$where .= " AND post_mime_type LIKE 'audio/%' OR post_mime_type LIKE 'video/%'";
		return $where;
	}
}

// Start up this plugin.
add_action( 'admin_init', 'rtgodam_retranscode_media' );

/**
 * Execute RetranscodeMedia constructor.
 */
function rtgodam_retranscode_media() { // phpcs:ignore Universal.Files.SeparateFunctionsFromOO.Mixed

	global $rtgodam_retranscode_media;

	$rtgodam_retranscode_media = new RTGODAM_RetranscodeMedia();
}
