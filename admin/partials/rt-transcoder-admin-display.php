<?php
/**
 * Transcoder admin settings.
 *
 * @since      1.0
 *
 * @package    Transcoder
 * @subpackage Transcoder/Admin/Partials
 */

$current_page = transcoder_filter_input( INPUT_GET, 'page', FILTER_SANITIZE_FULL_SPECIAL_CHARS );
?>
<div class="wrap">
	<h1 class="rtm-option-title">
		<?php esc_html_e( 'Transcoder Service Settings', 'godam' ); ?>
		<span class="alignright by">
			<a class="rt-link"
				href="https://rtmedia.io/?utm_source=dashboard&utm_medium=plugin&utm_campaign=transcoder"
				target="_blank"
				title="rtCamp : <?php esc_attr_e( 'Empowering The Web With WordPress', 'godam' ); ?>">
				<img src="<?php echo esc_url( GODAM_URL ); ?>admin/images/rtcamp-logo.png" alt="rtCamp"/>
			</a>
		</span>
	</h1>
	<div id="rtt-settings_updated" class="updated settings-error notice is-dismissible hide">
		<p></p>
		<button type="button" class="notice-dismiss">
			<span class="screen-reader-text"><?php esc_html_e( 'Dismiss this notice', 'godam' ); ?>.</span>
		</button>
	</div>
	<div class="transcoder-settings-boxes-wrapper">
		<div id="transcoder-settings-boxes" class="transcoder-settings-boxes-container transcoder-setting-container">
			<p>
			<form method="get" action="<?php echo esc_url( admin_url( 'admin.php' ) ); ?>">
				<label for="new-api-key">
					<?php esc_html_e( 'Enter License Key', 'godam' ); ?>
				</label>
				<input type="hidden" name="page" value="<?php echo esc_attr( $current_page ); ?>">
				<input id="new-api-key" type="text" name="apikey" value="<?php echo esc_attr( $this->stored_api_key ); ?>" size="60"/>
				<button type="submit" id="api-key-submit" name="update" value="true" class="button-primary"><?php esc_html_e( 'Save Key', 'godam' ); ?></button>
			</form>
			</p>

			<p>
				<?php

				$enable_btn_style  = 'display:none;';
				$disable_btn_style = 'display:none;';

				if ( $this->api_key ) {
					$enable_btn_style = 'display:inline;';
				} elseif ( $this->stored_api_key ) {
					$disable_btn_style = 'display:inline;';
				}
				?>
				<input type="submit" id="disable-transcoding" name="disable-transcoding" value="Disable Transcoding" class="button-secondary" style="<?php echo esc_attr( $enable_btn_style ); ?>"/>
				<input type="submit" id="enable-transcoding" name="enable-transcoding" value="Enable Transcoding" class="button-secondary" style="<?php echo esc_attr( $disable_btn_style ); ?>"/>
			</p>

			<!-- Results table headers -->
			<table class="fixed widefat transcoder-plan-table">
				<thead>
				<tr>
					<th>
						<?php esc_html_e( 'Feature\Plan', 'godam' ); ?>
					</th>
					<th>
						<?php esc_html_e( 'Free', 'godam' ); ?>
					</th>
					<th>
						<?php esc_html_e( 'Silver', 'godam' ); ?>
					</th>
				</tr>
				</thead>

				<tbody>
				<tr>
					<th>
						<?php esc_html_e( 'File Size Limit', 'godam' ); ?>
					</th>
					<td>
						<?php esc_html_e( '100MB', 'godam' ); ?>
					</td>
					<td>
						<?php esc_html_e( '16GB', 'godam' ); ?>
					</td>
				</tr>
				<tr>
					<th>
						<?php esc_html_e( 'Bandwidth (monthly)', 'godam' ); ?>
					</th>
					<td>
						<?php esc_html_e( '5GB', 'godam' ); ?>
					</td>
					<td>
						<?php esc_html_e( '100GB', 'godam' ); ?>
					</td>
				</tr>
				<tr>
					<th>
						<?php esc_html_e( 'Overage Bandwidth', 'godam' ); ?>
					</th>
					<td>
						<?php esc_html_e( 'Not Available', 'godam' ); ?>
					</td>
					<td>
						<?php esc_html_e( 'Currently not charged', 'godam' ); ?>
					</td>
				</tr>
				<tr>
					<th>
						<?php esc_html_e( 'Amazon S3 Support', 'godam' ); ?>
					</th>
					<td>
						<?php esc_html_e( 'Not Available', 'godam' ); ?>
					</td>
					<td>
						<?php esc_html_e( 'Coming Soon', 'godam' ); ?>
					</td>
				</tr>
				<tr>
					<th>
						<?php esc_html_e( 'HD Profile', 'godam' ); ?>
					</th>
					<td>
						<?php esc_html_e( 'Not Available', 'godam' ); ?>
					</td>
					<td>
						<?php esc_html_e( 'Coming Soon', 'godam' ); ?>
					</td>
				</tr>
				<tr>
					<th>
						<?php esc_html_e( 'Pricing', 'godam' ); ?>
					</th>
					<td>
						<?php esc_html_e( 'Free', 'godam' ); ?>
					</td>
					<td>
						<?php esc_html_e( '$9/month', 'godam' ); ?>
					</td>
				</tr>
				<tr>
					<th>
						&nbsp;
					</th>
					<td>
						<?php

						$allowed_tags = array(
							'a'        => array(
								'href'   => array(),
								'target' => array(),
								'title'  => array(),
								'class'  => array(),
							),
							'div'      => array(
								'title' => array(),
								'id'    => array(),
							),
							'button'   => array(
								'disabled'   => array(),
								'data-plan'  => array(),
								'data-price' => array(),
								'type'       => array(),
								'class'      => array(),
							),
							'textarea' => array(
								'rows' => array(),
								'cols' => array(),
								'id'   => array(),
							),
							'p'        => array(),
						);

						$button = $this->transcoding_subscription_button( 'free', 0 );
						echo wp_kses( $button, $allowed_tags );
						?>
					</td>
					<td>
						<?php

						$button = $this->transcoding_subscription_button( 'silver', 9 );
						echo wp_kses( $button, $allowed_tags );
						?>
					</td>
				</tr>
				</tbody>
			</table>

			<div class="transcoder-notice">
				<p>
					<?php

					$allowed_tags = array(
						'i'      => array(),
						'strong' => array(),
					);
					printf( wp_kses( __( '<strong>Note</strong>: Transcoder will only work on publicly accessible websites. If you are using Transcoder on a <strong>locally hosted website</strong> (i.e. <strong>localhost</strong>), we will be unable to identify the source of your audio/video transcoding requests.', 'godam' ), $allowed_tags ) );
					?>

				</p>
			</div>

			<div class="transcoder-setting-form">
				<form method="post" action="options.php">
					<?php

					settings_fields( 'rtgodam-settings-group' );
					do_settings_sections( 'rtgodam-settings-group' );
					?>
					<table class="form-table">
						<tr valign="top">
							<td scope="row">
								<?php esc_html_e( 'Number of video thumbnails generated', 'godam' ); ?>
							</td>
							<td>
								<?php

								$number_of_thumbnails = get_option( 'number_of_thumbs', 5 );
								if ( empty( $number_of_thumbnails ) ) {
									$number_of_thumbnails = 5;
								}
								?>
								<input type="number" name="number_of_thumbs" value="<?php echo esc_attr( $number_of_thumbnails ); ?>" min="1" max="10"/>
								<span class="rtm-tooltip">
									<i class="dashicons dashicons-info"></i>
									<span class="rtm-tip">
										<?php

										esc_html_e( 'This field specifies the number of video thumbnails that will be generated by the GoDAM. To choose from the generated thumbnails for a video, go to ​Media > Edit > Video Thumbnails. Thumbnails are only generated when the video is first uploaded. Maximum value is 10.', 'godam' );
										?>
									</span>
								</span>
							</td>
						</tr>
						<tr valign="top">
							<td scope="row">
								<?php esc_html_e( 'Over-write video thumbnails after retranscoding', 'godam' ); ?>
							</td>
							<td>
								<?php

								$rtgodam_override_thumbnail = get_option( 'rtgodam_override_thumbnail', false );
								?>
								<input type="checkbox" name="rtgodam_override_thumbnail" value="1" <?php checked( $rtgodam_override_thumbnail, 1 ); ?> />
								<span class="rtm-tooltip">
									<i class="dashicons dashicons-info" style="padding-top:3px"></i>
									<span class="rtm-tip">
										<?php

										esc_html_e( 'If enabled, GoDAM will replace existing media thumbnails with regenerated ones after retranscoding. If disabled, media thumbnails will remain untouched.', 'godam' );
										?>
									</span>
								</span>
							</td>
						</tr>
						<tr valign="top">
							<td scope="row">
								<?php esc_html_e( 'Allow admin to track real-time transcoding status on user profile', 'godam' ); ?>
							</td>
							<td>
								<?php

								$rtgodam_check_status_btn = get_option( 'rtgodam_client_check_status_button', false );
								?>
								<input type="checkbox" name="rtgodam_client_check_status_button" value="1" <?php checked( $rtgodam_check_status_btn, 1 ); ?> />
								<span class="rtm-tooltip">
									<i class="dashicons dashicons-info" style="padding-top:3px"></i>
									<span class="rtm-tip">
										<?php

										esc_html_e( 'If enabled, It will display check status button to know status of transcoding process at client side if that user have administrator rights.', 'godam' );
										?>
									</span>
								</span>
							</td>
						</tr>
					</table>
					<p>
						<?php

						echo wp_kses(
							sprintf(
								/* translators: 1. URL of documentation page. */
								__( 'Visit our <a href="%1$s">documentation page</a> for more details', 'godam' ),
								'https://rtmedia.io/docs/transcoder/'
							),
							array(
								'a' => array(
									'href' => array(),
								),
							)
						);
						?>
					</p>
					<div class="rtm-button-container">
						<div class="rtm-social-links alignleft">
							<a href="http://twitter.com/rtMediaWP" class="twitter" target="_blank">
								<span class="dashicons dashicons-twitter"></span>
							</a>
							<a href="https://www.facebook.com/rtmediawp/" class="facebook" target="_blank">
								<span class="dashicons dashicons-facebook"></span>
							</a>
							<a href="http://profiles.wordpress.org/rtcamp" class="wordpress" target="_blank">
								<span class="dashicons dashicons-wordpress"></span>
							</a>
							<a href="https://rtmedia.io/feed/" class="rss" target="_blank">
								<span class="dashicons dashicons-rss"></span>
							</a>
						</div>
						<input id="submit" class="button button-primary alignright" type="submit" value="Save Changes" name="submit">
					</div>
				</form>
			</div>
		</div>
	</div>

	<div class="metabox-holder transcoder-sidebar">
		<?php do_action( 'rtgodam_transcoder_before_widgets' ); ?>
		<div class="postbox" id="rt-spread-the-word">
			<h3 class="hndle">
				<span>
					<?php esc_html_e( 'Spread the Word', 'godam' ); ?>
				</span>
			</h3>
			<div class="inside">
				<div id="social" class="rtm-social-share">
					<?php

					// translators: Placeholde contains link of the home url.
					$message = sprintf( esc_html__( 'I use @rtMediaWP http://rt.cx/rtmedia on %s', 'godam' ), home_url() );
					?>
					<p>
						<a href="http://twitter.com/home/?status=<?php echo esc_attr( $message ); ?>" class="button twitter" target= "_blank" title="<?php esc_attr_e( 'Post to Twitter Now', 'godam' ); ?>">
							<?php esc_html_e( 'Post to Twitter', 'godam' ); ?>
							<span class="dashicons dashicons-twitter"></span>
						</a>
					</p>
					<p>
						<a href="https://www.facebook.com/sharer/sharer.php?u=https://rtmedia.io/" class="button facebook" target="_blank" title="<?php esc_attr_e( 'Share on Facebook Now', 'godam' ); ?>">
							<?php esc_html_e( 'Share on Facebook', 'godam' ); ?>
							<span class="dashicons dashicons-facebook"></span>
						</a>
					</p>
					<p>
						<a href="http://wordpress.org/support/view/plugin-reviews/transcoder?rate=5#postform" class="button wordpress" target= "_blank" title="<?php esc_attr_e( 'Rate rtMedia on Wordpress.org', 'godam' ); ?>">
							<?php esc_html_e( 'Rate on Wordpress.org', 'godam' ); ?>
							<span class="dashicons dashicons-wordpress"></span>
						</a>
					</p>
					<p>
						<a href="https://rtmedia.io/feed/" class="button rss" target="_blank" title="<?php esc_attr_e( 'Subscribe to our Feeds', 'godam' ); ?>">
							<?php esc_html_e( 'Subscribe to our Feeds', 'godam' ); ?>
							<span class="dashicons dashicons-rss"></span>
						</a>
					</p>
				</div>
			</div>
		</div>
		<div class="postbox" id="rt-subscribe">
			<h3 class="hndle">
				<span>
					<?php esc_html_e( 'Subscribe', 'godam' ); ?>
				</span>
			</h3>
			<div class="inside">
				<?php $the_current_user = wp_get_current_user(); ?>
				<form
					action="http://rtcamp.us1.list-manage1.com/subscribe/post?u=85b65c9c71e2ba3fab8cb1950&amp;id=9e8ded4470"
					method="post" id="mc-embedded-subscribe-form" name="mc-embedded-subscribe-form" class="validate"
					target="_blank" novalidate>
					<div class="mc-field-group">
						<input type="email" value="<?php echo esc_attr( $the_current_user->user_email ); ?>" name="EMAIL" placeholder="Email" class="required email" id="mce-EMAIL" />
						<input style="display:none;" type="checkbox" checked="checked" value="1" name="group[1721][1]" id="mce-group[1721]-1721-0" />
						<input type="submit" value="<?php esc_attr_e( 'Subscribe', 'godam' ); ?>" name="subscribe" id="mc-embedded-subscribe" class="button" />
						<div id="mce-responses" class="clear">
							<div class="response" id="mce-error-response" style="display:none"></div>
							<div class="response" id="mce-success-response" style="display:none"></div>
						</div>
					</div>
				</form>
			</div>
		</div>
	</div>
</div>
