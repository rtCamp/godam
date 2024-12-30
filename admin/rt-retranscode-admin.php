<?php
/**
 * Retranscode media https://wordpress.org/plugins/regenerate-thumbnails/
 * The code and UI is borrowed from the following plugin (Author: Alex Mills).
 *
 * @package transcoder
 */

/**
 * Media retranscode module.
 */
class RetranscodeMedia {
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
	 * Functinallity initialization
	 */
	public function __construct() {

		$this->api_key        = get_site_option( 'rt-transcoding-api-key' );
		$this->stored_api_key = get_site_option( 'rt-transcoding-api-key-stored' );

		$this->usage_info = get_site_option( 'rt-transcoding-usage' );
		// Load Rest Endpoints.
		$this->load_rest_endpoints();

		// Do not activate re-transcoding without valid license key
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

		add_action( 'admin_menu', array( $this, 'add_admin_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'admin_enqueues' ) );
		add_action( 'wp_ajax_retranscodemedia', array( $this, 'ajax_process_retranscode_request' ) );
		add_filter( 'media_row_actions', array( $this, 'add_media_row_action' ), 10, 2 );
		add_action( 'admin_head-upload.php', array( $this, 'add_bulk_actions_via_javascript' ) );
		add_action( 'admin_action_bulk_retranscode_media', array( $this, 'bulk_action_handler' ) ); // Top drowndown.
		add_action( 'admin_action_-1', array( $this, 'bulk_action_handler' ) ); // Bottom dropdown (assumes top dropdown = default value).
		add_action( 'rtt_before_thumbnail_store', array( $this, 'rtt_before_thumbnail_store' ), 10, 2 ); // Delete old thumbs.
		add_action( 'rtt_before_transcoded_media_store', array( $this, 'rtt_before_transcoded_media_store' ), 10, 2 ); // Delete old transcoded files.
		add_action( 'transcoded_thumbnails_added', array( $this, 'transcoded_thumbnails_added' ), 10, 1 ); // Add the current thumbnail to the newly added thumbnails.
		add_action( 'rtt_handle_callback_finished', array( $this, 'rtt_handle_callback_finished' ), 10, 2 ); // Clean the extra meta that has been added while sending retranscoding request.
		add_filter( 'amp_story_allowed_video_types', array( $this, 'add_amp_video_extensions' ) ); // Extend allowed video mime type extensions for AMP Story Background.
		add_filter( 'render_block', array( $this, 'update_amp_story_video_url' ), 10, 2 ); // Filter block content and replace video URLs.

		// Allow people to change what capability is required to use this feature.
		$this->capability = apply_filters( 'retranscode_media_cap', 'manage_options' );
	}

	/**
	 * Function to load rest api endpoints.
	 *
	 * @return void
	 */
	public function load_rest_endpoints() {
		include_once RT_TRANSCODER_PATH . 'admin/rt-transcoder-rest-routes.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant

		// Create class object and register routes.
		$transcoder_rest_routes = new Transcoder_Rest_Routes();
		add_action( 'rest_api_init', array( $transcoder_rest_routes, 'register_routes' ) );
	}

	/**
	 * Register the management page.
	 *
	 * @return void
	 */
	public function add_admin_menu() {

		add_submenu_page(
			'rt-transcoder',
			'Transcoder',
			'Settings',
			'manage_options',
			'rt-transcoder',
			array( $this, '_transcoder_settings_page' )
		);

		$this->menu_id = add_submenu_page(
			'rt-transcoder',
			__( 'Retranscode Media', 'transcoder' ),
			__( 'Retranscode Media', 'transcoder' ),
			$this->capability,
			'rt-retranscoder',
			array( $this, 'retranscode_interface' )
		);
	}

	/**
	 * Transcoder settings render.
	 *
	 * Note: DO NOT USE directly.
	 *
	 * @return void
	 */
	public function _transcoder_settings_page() {
		include_once RT_TRANSCODER_PATH . 'admin/partials/rt-transcoder-admin-display.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant
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

		// WordPress 3.1 vs older version compatibility.
		if ( wp_script_is( 'jquery-ui-widget', 'registered' ) ) {
			wp_enqueue_script( 'jquery-ui-progressbar', plugins_url( 'js/jquery.ui.progressbar.min.js', __FILE__ ), array( 'jquery-ui-core', 'jquery-ui-widget' ), '1.8.6', true );
		} else {
			wp_enqueue_script( 'jquery-ui-progressbar', plugins_url( 'js/jquery.ui.progressbar.min.1.7.2.js', __FILE__ ), array( 'jquery-ui-core' ), '1.7.2', true );
		}

		wp_enqueue_style( 'jquery-ui-retranscodemedia', plugins_url( 'css/jquery-ui-1.7.2.custom.css', __FILE__ ), array(), '1.7.2' );
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
			'audio/mpeg' === $post->post_mime_type ||
			! current_user_can( $this->capability )
		) {
			return $actions;
		}

		$actions = ( ! empty( $actions ) && is_array( $actions ) ) ? $actions : array();

		$url = wp_nonce_url( admin_url( 'admin.php?page=rt-retranscoder&goback=1&ids=' . $post->ID ), 'rt-retranscoder' );

		$actions['retranscode_media'] = sprintf(
			'<a href="%s" title="%s">%s</a>',
			esc_url( $url ),
			esc_attr__( 'Retranscode this single media', 'transcoder' ),
			__( 'Retranscode Media', 'transcoder' )
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

		$actions['bulk_retranscode_media'] = __( 'Retranscode Media', 'transcoder' );

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
		?>
		<script type="text/javascript">
			jQuery(document).ready(function($){
				$('select[name^="action"] option:last-child').before('<option value="bulk_retranscode_media"><?php esc_html_e( 'Retranscode Media', 'transcoder' ); ?></option>');
			});
		</script>
		<?php
	}

	/**
	 * Handles the bulk actions POST
	 *
	 * @return void
	 */
	public function bulk_action_handler() {
		$action  = transcoder_filter_input( INPUT_GET, 'action', FILTER_SANITIZE_FULL_SPECIAL_CHARS );
		$action2 = transcoder_filter_input( INPUT_GET, 'action2', FILTER_SANITIZE_FULL_SPECIAL_CHARS );
		$media   = transcoder_filter_input( INPUT_GET, 'media', FILTER_SANITIZE_NUMBER_INT, FILTER_REQUIRE_ARRAY );

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
			wp_create_nonce( 'rt-retranscoder' ),
			admin_url( 'admin.php?page=rt-retranscoder&goback=1&ids=' . $ids )
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
	<h2><?php esc_html_e( 'Retranscode Media', 'transcoder' ); ?></h2>

		<?php

		// If the button was clicked.
		if ( ! empty( $_POST['rt-retranscoder'] ) || ! empty( $_REQUEST['ids'] ) ) {
			// Capability check.
			if ( ! current_user_can( $this->capability ) ) {
				wp_die( esc_html__( 'Cheatin&#8217; uh?', 'transcoder' ) );
			}

			// Form nonce check.
			check_admin_referer( 'rt-retranscoder' );

			$file_size = 0;
			$files     = array();

			// Create the list of image IDs.
			$usage_info = get_site_option( 'rt-transcoding-usage' );
			$ids        = transcoder_filter_input( INPUT_GET, 'ids', FILTER_SANITIZE_FULL_SPECIAL_CHARS );
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
					echo '	<p>' . sprintf( esc_html__( "Unable to find any media. Are you sure <a href='%s'>some exist</a>?", 'transcoder' ), esc_url( admin_url( 'upload.php' ) ) ) . '</p></div>';
					return;
				}

				// Generate the list of IDs.
				$ids = array();
				foreach ( $media as $i => $each ) {
					if ( ! in_array( $each->post_mime_type, array( 'audio/mp3', 'audio/mpeg' ), true ) ) {
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
					} elseif ( in_array( $each->post_mime_type, array( 'audio/mp3', 'audio/mpeg' ), true ) ) {
						unset( $media[ $i ] );
					}
				}
				$ids = implode( ',', $ids );
			}

			if ( empty( $ids ) ) {
				echo '	<p>' . esc_html__( 'There are no media available to send for transcoding.', 'transcoder' ) . '</p>';
				return;
			}

			if ( isset( $usage_info ) && is_array( $usage_info ) && array_key_exists( $this->api_key, $usage_info ) ) {
				if ( is_object( $usage_info[ $this->api_key ] ) && isset( $usage_info[ $this->api_key ]->status ) && $usage_info[ $this->api_key ]->status ) {
					if ( isset( $usage_info[ $this->api_key ]->remaining ) && $usage_info[ $this->api_key ]->remaining > 0 ) {
						if ( $usage_info[ $this->api_key ]->remaining < $file_size ) {
							$this->retranscode_admin_error_notice();
							// User doesn't have enough bandwidth remaining for re-transcoding.
							echo '	<p>' . esc_html__( 'You do not have sufficient bandwidth remaining to perform the transcoding.', 'transcoder' ) . '</p>';
							echo '	<p><b>' . esc_html__( 'Your remaining bandwidth is : ', 'transcoder' ) . esc_html( size_format( $usage_info[ $this->api_key ]->remaining, 2 ) ) . '</b></p>';
							echo '	<p><b>' . esc_html__( 'Required bandwidth is: ', 'transcoder' ) . esc_html( size_format( $file_size, 2 ) ) . '</b></p></div>';
							if ( $usage_info[ $this->api_key ]->remaining > 0 ) {
								if ( is_array( $files ) && count( $files ) > 0 ) {
									?>
									<div><p><?php esc_html_e( 'You can select the files manually and try again.', 'transcoder' ); ?></p>
									<form method="POST" action="<?php esc_url( admin_url( 'admin.php' ) ); ?>">
									<?php wp_nonce_field( 'rt-retranscoder' ); ?>
									<input type="hidden" name="page" value="rt-retranscoder">
									<table border=0>
									?>
										<tr>
											<td><input type="submit" class="button button-primary button-small" value="<?php esc_attr_e( 'Proceed with retranscoding', 'transcoder' ); ?>"></td>
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
											<td><input type="submit" class="button button-primary button-small" value="<?php esc_attr_e( 'Proceed with retranscoding', 'transcoder' ); ?>" ></td>
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
			<p><?php esc_html_e( 'Your files are being re-transcoded. Do not navigate away from this page until the process is completed, as doing so will prematurely abort the script. Retranscoding can take a while, especially for larger files. You can view the progress below.', 'transcoder' ); ?></p>

			<?php
			$count = count( $media );


			// translators: Count of media which were successfully transcoded with the time in seconds.
			$text_goback = ( ! empty( $_GET['goback'] ) ) ? __( 'To go back to the previous page, <a id="retranscode-goback" href="#">click here</a>.', 'transcoder' ) : '';

			// translators: Count of media which were successfully and media which were failed transcoded with the time in seconds and previout page link.
			$text_failures = sprintf( __( 'All done! %1$s media file(s) were successfully sent for transcoding in %2$s seconds and there were %3$s failure(s). To try transcoding the failed media again, <a href="%4$s">click here</a>. %5$s', 'transcoder' ), "' + rt_successes + '", "' + rt_totaltime + '", "' + rt_errors + '", esc_url( wp_nonce_url( admin_url( 'admin.php?page=rt-retranscoder&goback=1' ), 'rt-retranscoder' ) . '&ids=' ) . "' + rt_failedlist + '", $text_goback );
			// translators: Count of media which were successfully transcoded with the time in seconds and previout page link.
			$text_nofailures = sprintf( __( 'All done! %1$s media file(s) were successfully sent for transcoding in %2$s seconds and there were 0 failures. %3$s', 'transcoder' ), "' + rt_successes + '", "' + rt_totaltime + '", $text_goback );
			?>


	<noscript><p><em><?php esc_html_e( 'You must enable Javascript in order to proceed!', 'transcoder' ); ?></em></p></noscript>

	<div id="retranscodemedia-bar" style="position:relative;height:25px;">
		<div id="retranscodemedia-bar-percent" style="position:absolute;left:50%;top:50%;width:300px;margin-left:-150px;height:25px;margin-top:-9px;font-weight:bold;text-align:center;"></div>
	</div>

	<p><input type="button" class="button hide-if-no-js" name="retranscodemedia-stop" id="retranscodemedia-stop" value="<?php esc_attr_e( 'Abort the Operation', 'transcoder' ); ?>" /></p>

	<h3 class="title"><?php esc_html_e( 'Debugging Information', 'transcoder' ); ?></h3>

	<p>
			<?php
			// translators: Total count of the media.
			printf( esc_html__( 'Total Media: %s', 'transcoder' ), esc_html( $count ) );
			?>
			<br />
			<?php
			// translators: Count of media which were successfully sent to the transcoder server.
			printf( esc_html__( 'Media Sent for Retranscoding: %s', 'transcoder' ), '<span id="retranscodemedia-debug-successcount">0</span>' );
			?>
			<br />
			<?php
			// translators: Count of media which were failed while sending to the transcoder server.
			printf( esc_html__( 'Failed While Sending: %s', 'transcoder' ), '<span id="retranscodemedia-debug-failurecount">0</span>' );
			?>
	</p>

	<ol id="retranscodemedia-debuglist">
		<li style="display:none"></li>
	</ol>

	<script type="text/javascript">
	// <![CDATA[
		jQuery(document).ready(function($){
			var i;
			var rt_media = [<?php echo esc_js( $ids ); ?>];
			var rt_total = rt_media.length;
			var rt_count = 1;
			var rt_percent = 0;
			var rt_successes = 0;
			var rt_errors = 0;
			var rt_failedlist = '';
			var rt_resulttext = '';
			var rt_timestart = new Date().getTime();
			var rt_timeend = 0;
			var rt_totaltime = 0;
			var rt_continue = true;

			// Create the progress bar
			$("#retranscodemedia-bar").progressbar();
			$("#retranscodemedia-bar-percent").html( "0%" );

			// Stop button
			$("#retranscodemedia-stop").click(function() {
				rt_continue = false;
				$('#retranscodemedia-stop').val("<?php echo esc_js( $this->esc_quotes( __( 'Stopping...', 'transcoder' ) ) ); ?>");
			});

			// Clear out the empty list element that's there for HTML validation purposes
			$("#retranscodemedia-debuglist li").remove();

			// Called after each resize. Updates debug information and the progress bar.
			function RetranscodeMediaUpdateStatus( id, success, response ) {
				$("#retranscodemedia-bar").progressbar( "value", ( rt_count / rt_total ) * 100 );
				$("#retranscodemedia-bar-percent").html( Math.round( ( rt_count / rt_total ) * 1000 ) / 10 + "%" );
				rt_count = rt_count + 1;

				if ( success ) {
					rt_successes = rt_successes + 1;
					$("#retranscodemedia-debug-successcount").html(rt_successes);
					$("#retranscodemedia-debuglist").append("<li>" + response.success + "</li>");
				}
				else {
					rt_errors = rt_errors + 1;
					rt_failedlist = rt_failedlist + ',' + id;
					$("#retranscodemedia-debug-failurecount").html(rt_errors);
					$("#retranscodemedia-debuglist").append("<li>" + response.error + "</li>");
				}
			}

			// Called when all images have been processed. Shows the results and cleans up.
			function RetranscodeMediaFinishUp() {
				rt_timeend = new Date().getTime();
				rt_totaltime = Math.round( ( rt_timeend - rt_timestart ) / 1000 );

				$('#retranscodemedia-stop').hide();

				<?php
				// Allowed tags for notice.
				$allowed_tags = array(
					'a' => array(
						'href' => array(),
						'id'   => array(),
					),
				);
				?>

				if ( rt_errors > 0 ) {
					rt_resulttext = '<?php echo wp_kses( $text_failures, $allowed_tags ); ?>';
				} else {
					rt_resulttext = '<?php echo wp_kses( $text_nofailures, $allowed_tags ); ?>';
				}
				$("#message").html("<p><strong>" + rt_resulttext + "</strong></p>");
				$("#message").show();

				$( '#retranscode-goback' ).on( 'click', function () {
					window.history.go( -1 );
				} );

			}
			<?php
				// translators: Media ID.
				$error_response = sprintf( __( 'The resize request was abnormally terminated (ID %s). This is likely due to the media exceeding available memory or some other type of fatal error.', 'transcoder' ), '" + id + "' );
			?>
			// Regenerate a specified image via AJAX
			function RetranscodeMedia( id ) {
				$.ajax({
					type: 'POST',
					url: ajaxurl,
					data: { action: "retranscodemedia", id: id },
					success: function( response ) {
						if ( response !== Object( response ) || ( typeof response.success === "undefined" && typeof response.error === "undefined" ) ) {
							response = new Object;
							response.success = false;
							response.error = '<?php echo esc_js( $error_response ); ?>';
						}

						if ( response.success ) {
							RetranscodeMediaUpdateStatus( id, true, response );
						}
						else {
							RetranscodeMediaUpdateStatus( id, false, response );
						}

						if ( rt_media.length && rt_continue ) {
							RetranscodeMedia( rt_media.shift() );
						}
						else {
							RetranscodeMediaFinishUp();
						}
					},
					error: function( response ) {
						RetranscodeMediaUpdateStatus( id, false, response );

						if ( rt_media.length && rt_continue ) {
							RetranscodeMedia( rt_media.shift() );
						}
						else {
							RetranscodeMediaFinishUp();
						}
					}
				});
			}

			RetranscodeMedia( rt_media.shift() );
		});
	// ]]>
	</script>
			<?php
		} else {
			// No button click? Display the form.
			?>
	<form method="post" action="">
			<?php wp_nonce_field( 'rt-retranscoder' ); ?>

	<p><?php printf( esc_html__( 'This tool will retranscode ALL audio/video media uploaded to your website. This can be handy if you need to transcode media files uploaded in the past.', 'transcoder' ) ); ?>

	<i><?php printf( esc_html__( 'Sending your entire media library for retranscoding can consume a lot of your bandwidth allowance, so use this tool with care.', 'transcoder' ) ); ?></i></p>

	<p>
			<?php
			// translators: Placeholder is for admin media section link.
			printf( wp_kses( __( "You can retranscode specific media files (rather than ALL media) from the <a href='%s'>Media</a> page using Bulk Action via drop down or mouse hover a specific media (audio/video) file.", 'transcoder' ), array( 'a' => array( 'href' => array() ) ) ), esc_url( admin_url( 'upload.php' ) ) );
			?>
	</p>

	<p><?php esc_html_e( 'To begin, just press the button below.', 'transcoder' ); ?></p>

	<p><input type="submit" class="button hide-if-no-js button button-primary" name="rt-retranscoder" id="rt-retranscoder" value="<?php esc_attr_e( 'Retranscode All Media', 'transcoder' ); ?>" /></p>

	<noscript><p><em><?php esc_html_e( 'You must enable Javascript in order to proceed!', 'transcoder' ); ?></em></p></noscript>

	</form>
			<?php
		} // End if button
		?>
</div>

		<?php
	}


	/**
	 * Process a single image ID (this is an AJAX handler)
	 */
	public function ajax_process_retranscode_request() {

		header( 'Content-type: application/json' );
		$id = transcoder_filter_input( INPUT_POST, 'id', FILTER_SANITIZE_NUMBER_INT );
		$id = intval( $id );

		if ( empty( $id ) || 0 >= $id ) {
			wp_send_json_error();
		}

		$media = get_post( $id );

		if ( ! $media || 'attachment' !== $media->post_type ||
			(
				'audio/' !== substr( $media->post_mime_type, 0, 6 ) &&
				'video/' !== substr( $media->post_mime_type, 0, 6 ) &&
				'application/pdf' !== $media->post_mime_type
			)
		) {
			// translators: Media id of the invalid media type.
			die( wp_json_encode( array( 'error' => sprintf( __( 'Sending Failed: %d is an invalid media ID/type.', 'transcoder' ), intval( $id ) ) ) ) );
		}

		if ( 'audio/mpeg' === $media->post_mime_type ) {
			// translators: Placeholder is for Media Name and ID of media.
			die( wp_json_encode( array( 'error' => sprintf( __( '&quot;%1$s&quot; (ID %2$s) is MP3 file already. No need to send for transcoding', 'transcoder' ), esc_html( get_the_title( $media->ID ) ), $media->ID ) ) ) );
		}

		if ( ! current_user_can( $this->capability ) ) {
			$this->die_json_error_msg( $media->ID, __( "Your user account doesn't have permission to transcode", 'transcoder' ) );
		}

		// Check if media is already being transcoded.
		if ( is_file_being_transcoded( $media->ID ) ) {
			$this->die_json_error_msg( $media->ID, sprintf( __( 'The media is already being transcoded', 'transcoder' ) ) );
		}

		/**
		 * Check if `_rt_transcoding_job_id` meta is present for the media
		 * if it's present then media won't get sent to the transcoder
		 * so we need to delete `_rt_transcoding_job_id` meta before we send
		 * media back for the retranscoding
		 */
		$already_sent = get_post_meta( $media->ID, '_rt_transcoding_job_id', true );

		if ( ! empty( $already_sent ) ) {
			delete_post_meta( $media->ID, '_rt_transcoding_job_id' );
		}

		// Get the transcoder object.
		$transcoder = new RT_Transcoder_Handler( true );

		$attachment_meta = array( 'mime_type' => $media->post_mime_type );

		$transcoded_files = get_post_meta( $media->ID, '_rt_media_transcoded_files', true );

		// No need to ask for the transcoded (mp4) file if we already have it.
		// Only asks for the thumbnails.

		if ( ! empty( $transcoded_files ) && is_array( $transcoded_files ) ) {
			if ( array_key_exists( 'mp4', $transcoded_files ) && count( $transcoded_files['mp4'] ) > 0 ) {

				/**
				 * We can ask for the new fresh transcoded file even if it already present.
				 * Use: add_filter( 'rtt_force_trancode_media', '__return_true' );
				 *
				 * @param bool FALSE by default. Pass TRUE if you want to request for new transcoded file
				 */
				$force_transcode = apply_filters( 'rtt_force_trancode_media', false );
				if ( ! $force_transcode ) {
					$attachment_meta['mime_type'] = 'video/mp4';
				}
			}
		}

		// Send media for (Re)transcoding.
		$transcoder->wp_media_transcoding( $attachment_meta, $media->ID );

		$is_sent = get_post_meta( $media->ID, '_rt_transcoding_job_id', true );

		if ( ! $is_sent ) {
			$this->die_json_error_msg( $media->ID, __( 'Unknown failure reason.', 'transcoder' ) );
		}

		update_post_meta( $media->ID, '_rt_retranscoding_sent', $is_sent );

		// translators: Media name, Media id and success message for successfull transcode.
		die( wp_json_encode( array( 'success' => sprintf( __( '&quot;%1$s&quot; (ID %2$s) was successfully sent in %3$s seconds.', 'transcoder' ), esc_html( get_the_title( $media->ID ) ), $media->ID, timer_stop() ) ) ) );
	}


	/**
	 * Helper to make a JSON error message
	 *
	 * @param int    $id ID of the attachment.
	 * @param string $message Error message.
	 */
	public function die_json_error_msg( $id, $message ) {
		// translators: Media name, Media ID and message for failed transcode.
		die( wp_json_encode( array( 'error' => sprintf( __( '&quot;%1$s&quot; (ID %2$s) failed to sent. The error message was: %3$s', 'transcoder' ), esc_html( get_the_title( $id ) ), $id, $message ) ) ) );
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
				<?php esc_html_e( 'Insufficient bandwidth!', 'transcoder' ); ?>
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
	public function rtt_before_thumbnail_store( $media_id = '', $post_request = '' ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed
		if ( empty( $media_id ) ) {
			return;
		}

		$previous_thumbs = get_post_meta( $media_id, '_rt_media_thumbnails', true );

		if ( ! empty( $previous_thumbs ) && is_array( $previous_thumbs ) ) {

			// Do not delete the current thumbnail of the video.
			if ( ! rtt_is_override_thumbnail() ) {

				$current_thumb = get_post_meta( $media_id, '_rt_media_video_thumbnail', true );

				$key = array_search( $current_thumb, $previous_thumbs, true );
				if ( false !== $key ) {
					unset( $previous_thumbs[ $key ] );
				}
			}

			rtt_delete_transcoded_files( $previous_thumbs );
		}
		delete_post_meta( $media_id, '_rt_media_thumbnails' );
	}

	/**
	 * Delete the previously transcoded media files
	 *
	 * @param  number $media_id     Post ID of the media.
	 * @param  array  $transcoded_files Post request coming for the transcoder API.
	 */
	public function rtt_before_transcoded_media_store( $media_id = '', $transcoded_files = '' ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed
		if ( empty( $media_id ) ) {
			return;
		}

		$current_files = get_post_meta( $media_id, '_rt_media_transcoded_files', true );

		if ( ! empty( $current_files ) && is_array( $current_files ) ) {
			foreach ( $current_files as $files ) {
				if ( ! empty( $files ) && is_array( $files ) ) {
					rtt_delete_transcoded_files( $files );
				}
			}
		}
		delete_post_meta( $media_id, '_rt_media_transcoded_files' );
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

		$is_retranscoding_job = get_post_meta( $media_id, '_rt_retranscoding_sent', true );

		if ( $is_retranscoding_job && ! rtt_is_override_thumbnail() ) {

			$new_thumbs = get_post_meta( $media_id, '_rt_media_thumbnails', true );

			if ( ! empty( $new_thumbs ) && is_array( $new_thumbs ) ) {

				$current_thumb = get_post_meta( $media_id, '_rt_media_video_thumbnail', true );
				if ( $current_thumb ) {
					$new_thumbs[] = $current_thumb;
					update_post_meta( $media_id, '_rt_media_thumbnails', $new_thumbs );
				}
			}
		}

		// Add thumbnail in media library for user selection and set attachment thumbnail.
		$thumbnail_array = get_post_meta( $media_id, '_rt_media_thumbnails', true );

		if ( is_array( $thumbnail_array ) ) {
			$uploads   = wp_upload_dir();
			$thumbnail = $thumbnail_array[0];

			if ( 0 === strpos( $thumbnail, $uploads['baseurl'] ) ) {
				$thumbnail_src = $thumbnail;
			} else {
				$thumbnail_src = trailingslashit( $uploads['basedir'] ) . $thumbnail;
			}

			$file_type = wp_check_filetype( basename( $thumbnail_src ), null );

			$attachment = array(
				'post_mime_type' => $file_type['type'],
				'post_title'     => preg_replace( '/\.[^.]+$/', '', basename( $thumbnail_src ) ),
				'post_content'   => '',
				'post_status'    => 'inherit',
			);

			// Insert transcoded thumbnail attachment.
			require_once ABSPATH . 'wp-admin/includes/image.php';
			$attachment_id = 0;
			// Generate thumbnail for PDF file.
			if ( 'application/pdf' === get_post_mime_type( $media_id ) ) {
				$attach_data = wp_generate_attachment_metadata( $media_id, $thumbnail_src );
				wp_update_attachment_metadata( $media_id, $attach_data );
			} else {
				// Insert transcoded thumbnail attachment for video/audio files.
				$attachment_id = wp_insert_attachment( $attachment, $thumbnail_src, $media_id );
			}

			// Generate attachment metadata for thumbnail and set post thumbnail for video/audio files.
			if ( ! is_wp_error( $attachment_id ) && 0 !== $attachment_id ) {
				$attach_data = wp_generate_attachment_metadata( $attachment_id, $thumbnail_src );
				wp_update_attachment_metadata( $attachment_id, $attach_data );
				set_post_thumbnail( $media_id, $attachment_id );
				update_post_meta( $attachment_id, 'amp_is_poster', true );
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
	public function rtt_handle_callback_finished( $attachment_id = '', $job_id = '' ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed
		if ( empty( $attachment_id ) ) {
			return;
		}

		$is_retranscoding_job = get_post_meta( $attachment_id, '_rt_retranscoding_sent', true );

		if ( $is_retranscoding_job ) {

			delete_post_meta( $attachment_id, '_rt_retranscoding_sent' );

		}
	}

	/**
	 * Add extensions to allow selection of more mime types in AMP Story.
	 *
	 * @param array $allowed_video_mime_types Allowed video types.
	 *
	 * @return array
	 */
	public function add_amp_video_extensions( $allowed_video_mime_types ) {
		return array_merge( $allowed_video_mime_types, array( 'video/webm', 'video/quicktime', 'video/avi', 'video/msvideo', 'video/x-msvideo', 'video/mpeg', 'video/x-flv', 'video/x-ms-wmv' ) );
	}

	/**
	 * Filter block content and replace AMP Video URL's with transcoded media.
	 *
	 * @param string $block_content Block Content.
	 * @param array  $block         Block Information.
	 *
	 * @return mixed
	 */
	public function update_amp_story_video_url( $block_content, $block ) {
		$allowed_blocks = array( 'amp/amp-story-page', 'core/video' );

		// Check if the block content should be filtered or not.
		if ( ! in_array( $block['blockName'], $allowed_blocks, true ) || is_admin() ) {
			return $block_content;
		}

		if ( isset( $block['attrs'] ) ) {
			$media_id = '';
			if ( isset( $block['attrs']['mediaId'] ) ) {
				$media_id = $block['attrs']['mediaId']; // For AMP Story Background Media.
			} elseif ( isset( $block['attrs']['id'] ) ) {
				$media_id = $block['attrs']['id']; // For AMP Story Video Block.
			}

			if ( ! empty( $media_id ) ) {
				$transcoded_url = get_post_meta( $media_id, '_rt_media_transcoded_files', true );

				if ( ! empty( $transcoded_url ) && isset( $transcoded_url['mp4'] ) ) {
					// Get transcoded video path.
					$transcoded_url = empty( $transcoded_url['mp4'][0] ) ? '' : $transcoded_url['mp4'][0];
					$uploads        = wp_get_upload_dir();

					// Get URL for the transcoded video.
					if ( 0 === strpos( $transcoded_url, $uploads['baseurl'] ) ) {
						$final_file_url = $transcoded_url;
					} else {
						$final_file_url = trailingslashit( $uploads['baseurl'] ) . $transcoded_url;
					}

					// Replace existing video URL with transcoded URL.
					if ( ! empty( $final_file_url ) ) {
						// Check for URL in amp-video tag.
						$amp_video_pattern = '/<amp-video (.*?) src="(?<url>.*?)" (.*?)>/m';
						preg_match_all( $amp_video_pattern, $block_content, $amp_tag_matches, PREG_SET_ORDER, 0 );

						if ( ! empty( $amp_tag_matches ) ) {
							foreach ( $amp_tag_matches as $amp_tag ) {
								if ( isset( $amp_tag['url'] ) ) {
									$block_content = str_replace( $amp_tag['url'], $final_file_url, $block_content );
								}
							}
						}

						// Check for URL in video tag.
						$video_pattern = '/<video (.*?) src="(?<url>.*?)"(.*?)>/m';
						preg_match_all( $video_pattern, $block_content, $video_tag_matches, PREG_SET_ORDER, 0 );

						if ( ! empty( $video_tag_matches ) ) {
							foreach ( $video_tag_matches as $video_tag ) {
								if ( isset( $video_tag['url'] ) ) {
									$block_content = str_replace( $video_tag['url'], $final_file_url, $block_content );
								}
							}
						}

						// Replace fallback poster with generated thumbnail.
						$amp_story_poster = '/<amp-video (.*?) poster="(?<poster>.*?)" (.*?)>/m';
						preg_match_all( $amp_story_poster, $block_content, $poster_matches, PREG_SET_ORDER, 0 );

						if ( ! empty( $poster_matches ) ) {
							foreach ( $poster_matches as $poster_match ) {
								if ( isset( $poster_match['poster'] ) ) {
									if ( false !== strpos( $poster_match['poster'], 'amp-story-fallback-poster.png' ) ) {
										$video_poster_url = get_the_post_thumbnail_url( $media_id );
										if ( false !== $video_poster_url ) {
											$block_content = str_replace( $poster_match['poster'], $video_poster_url, $block_content );
										}
									}
								}
							}
						}

						// Replace fallback poster with generated thumbnail for video block.
						$video_story_poster = '/<video (.*?) poster="(?<poster>.*?)" (.*?)>/m';
						preg_match_all( $video_story_poster, $block_content, $video_poster_matches, PREG_SET_ORDER, 0 );

						if ( ! empty( $video_poster_matches ) ) {
							foreach ( $video_poster_matches as $video_poster_match ) {
								if ( isset( $video_poster_match['poster'] ) ) {
									if ( false !== strpos( $video_poster_match['poster'], 'amp-story-video-fallback-poster.png' ) ) {
										$video_thumbnail_url = get_the_post_thumbnail_url( $media_id );
										if ( false !== $video_thumbnail_url ) {
											$block_content = str_replace( $video_poster_match['poster'], $video_thumbnail_url, $block_content );
										}
									}
								}
							}
						}
					}
				}
			}
		}

		return $block_content;
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
add_action( 'init', 'retranscode_media' );

/**
 * Execute RetranscodeMedia constructor.
 */
function retranscode_media() { // phpcs:ignore Universal.Files.SeparateFunctionsFromOO.Mixed

	global $RetranscodeMedia; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.VariableNotSnakeCase

	$RetranscodeMedia = new RetranscodeMedia(); // phpcs:ignore WordPress.NamingConventions.ValidVariableName.VariableNotSnakeCase
}
