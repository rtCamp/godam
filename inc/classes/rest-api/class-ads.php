<?php
/**
 * Register REST API endpoints for any Assets file endpoints.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

/**
 * Class LocationAPI
 */
class Ads extends Base {

	/**
	 * Setup hooks and initialization.
	 */
	protected function setup_hooks() {
		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
		add_filter( 'rest_pre_serve_request', array( $this, 'maybe_ad_url_tag_request' ), 10, 4 );
	}

	/**
	 * Get REST routes.
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/adTagURL',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_ad_tag_url' ),
						'permission_callback' => array( $this, 'get_ad_permissions_check' ),
						'args'                => $this->get_collection_params(),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/adTagURL/(?P<id>\d+)',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_video_ad_tag_url' ),
						'permission_callback' => array( $this, 'get_ad_permissions_check' ),
					),
				),
			),
		);
	}

	/**
	 * Check if request  is for /godam/v1/ad endpoint.
	 * Return the XML response if it is.
	 * 
	 * @param bool              $served Whether the request has already been served.
	 * @param \WP_REST_Response $result Result to send to the client. Usually a \WP_REST_Response.
	 * @param \WP_REST_Request  $request Request used to generate the response.
	 * @param \WP_REST_Server   $server Server instance.
	 * 
	 * @return bool
	 */
	public function maybe_ad_url_tag_request( $served, $result, $request, $server ) {

		// Check if the route of the current REST API request matches your custom route.
		if ( ! str_contains( $request->get_route(), '/godam/v1/adTagURL' ) ) {
			return $served;
		}

		// Set necessary CORS headers.
		header( 'Access-Control-Allow-Origin: *' ); // Allow all origins.
		header( 'Access-Control-Allow-Methods: GET, POST, OPTIONS' ); // Allow specific methods.
		header( 'Access-Control-Allow-Credentials: true' );
		header( 'Access-Control-Allow-Headers: Content-Type, Authorization, X-WP-Nonce' );
	
		// Ensure the response is XML.
		header( 'Content-Type: text/xml; charset=utf-8' );

		// Output the XML response and terminate the script.
		echo $result->get_data(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- The response is already escaped.
		
		return true;
	}

	/**
	 * Get a single Gravity Form.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_ad_tag_url( $request ) {
		// Retrieve and sanitize input parameters.
		$display_time = intval( $request->get_param( 'display_time' ) );
		$ad_duration  = intval( $request->get_param( 'duration' ) );
		$ad_title     = sanitize_text_field( $request->get_param( 'title' ) ?? '' );
		$skippable    = rest_sanitize_boolean( $request->get_param( 'skippable' ) ?? false );
		$skip_offset  = intval( $request->get_param( 'skip_offset' ) );
		$ad_url       = esc_url( $request->get_param( 'ad_url' ) ?? '' );
		$click_link   = esc_url( $request->get_param( 'click_link' ) ?? '' );
		$use_vmap     = rest_sanitize_boolean( $request->get_param( 'use_vmap' ) ?? false );
		
		// convert ad duration to HH:MM:SS format.  e.g. 16 seconds = 00:00:16.
		$display_time = gmdate( 'H:i:s', $display_time );
		$ad_duration  = gmdate( 'H:i:s', $ad_duration );

		// Current endpoint URL.
		$endpoint_url = rest_url( $this->namespace . sprintf( '/%s', empty( $this->rest_base ) ? 'adTagURL' : $this->rest_base . 'adTagURL' ) );
		
		ob_start();
		?>
			<VAST version="4.1" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns="http://www.iab.com/VAST">
				<Ad id="20001" sequence="1" conditionalAd="false">
					<InLine>
					<AdSystem version="4.1">GoDAM</AdSystem>
					<AdTitle><?php echo esc_html( $ad_title ); ?></AdTitle>
					<AdVerifications></AdVerifications>
					<Advertiser>GoDAM</Advertiser>
					<Creatives>
						<Creative id="5480" sequence="1" adId="2447226">
							<Linear <?php echo $skippable ? ' skipoffset="' . esc_attr( gmdate( 'H:i:s', $skip_offset ) ) . '"' : ''; ?>>
								<Duration><?php echo esc_html( $ad_duration ); ?></Duration>
								<MediaFiles>
									<MediaFile id="5241" delivery="progressive" type="video/mp4" bitrate="2000" width="1280" height="720" minBitrate="1500" maxBitrate="2500" scalable="1" maintainAspectRatio="1" codec="H.264">
										<![CDATA[<?php echo esc_url( $ad_url ); ?>]]>
									</MediaFile>
								</MediaFiles>
								<VideoClicks>
									<?php if ( ! empty( $click_link ) ) : ?>
										<ClickThrough id="blog">
											<![CDATA[<?php echo esc_url( $click_link ); ?>]]>
										</ClickThrough>
									<?php endif; ?>
								</VideoClicks>
							</Linear>
						</Creative>
					</Creatives>
					</InLine>
				</Ad>
			</VAST>
		<?php
		$vast_xml = ob_get_clean();
		
		ob_start();
		// Prepare GET request for VMAP.
		$vast_url = add_query_arg(
			array(
				'duration'    => $ad_duration,
				'title'       => $ad_title,
				'skippable'   => $skippable,
				'skip_offset' => $skip_offset,
				'ad_url'      => $ad_url,
				'click_link'  => $click_link,
			),
			$endpoint_url 
		);

		?>
			<vmap:VMAP xmlns:vmap="http://www.iab.net/videosuite/vmap" version="1.0">
				<vmap:AdBreak timeOffset="<?php echo esc_attr( $display_time ); ?>" breakType="linear" breakId="preroll">
					<vmap:AdSource id="preroll-ad-1" allowMultipleAds="false" followRedirects="true">
						<vmap:AdTagURI templateType="vast4">
							<![CDATA[ 
							<?php 
								echo esc_url_raw( $vast_url ); // The URL used here is for redirect purposes, so it must be raw. This will is used to get the VAST XML.
							?>
							]]>
						</vmap:AdTagURI>
					</vmap:AdSource>
				</vmap:AdBreak>
			</vmap:VMAP>
		<?php
		$vamp_xml = ob_get_clean();

		// return XML response.
		if ( $use_vmap ) {
			return $vamp_xml;
		}
		return $vast_xml;
	}

	/**
	 * Get a single Gravity Form.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_video_ad_tag_url( $request ) {

		$video_id = $request->get_param( 'id' );
		$video_id = intval( $video_id );


		if ( empty( $video_id ) ) {
			return '';
		}

		// Check if the video exists.
		$video = get_post( $video_id );
		if ( empty( $video ) || 'attachment' !== $video->post_type ) {
			return '';
		}

		// Get godam_meta data.
		godam_meta = get_post_meta( $video_id, 'rtgodam_meta', true );

		if ( empty( godam_meta ) ) {
			return '';
		}

		// Retrieve and sanitize input parameters.
		$layers = godam_meta['layers'] ?? array();

		// Get all layers with type `ads`.
		$ads_layers = array_filter(
			$layers,
			function ( $layer ) {
				return 'ad' === $layer['type'];
			}
		);

		// Prepare the VAST XML response.
		$vamp_xml = '';
		ob_start();
		?>
			<vmap:VMAP xmlns:vmap="http://www.iab.net/videosuite/vmap" version="1.0">
				<?php 
				foreach ( $ads_layers as $layer ) :
					// Current endpoint URL.
					$display_time = intval( $layer['displayTime'] ?? 0 );
					$ad_duration  = intval( $layer['duration'] ?? 0 );
					$ad_title     = $layer['title'] ?? '';
					$skippable    = $layer['skippable'] ?? false;
					$skip_offset  = intval( $layer['skip_offset'] ?? 0 );
					$ad_url       = esc_url( $layer['ad_url'] ) ?? '';
					$click_link   = esc_url( $layer['click_link'] ?? '' );
					
					$endpoint_url = rest_url( $this->namespace . sprintf( '/%s', empty( $this->rest_base ) ? 'adTagURL' : $this->rest_base . 'adTagURL' ) );
					$vast_url     = add_query_arg(
						array(
							'duration'    => $ad_duration,
							'title'       => $ad_title,
							'skippable'   => $skippable,
							'skip_offset' => $skip_offset,
							'ad_url'      => $ad_url,
							'click_link'  => $click_link,
						),
						$endpoint_url 
					);
					?>
					<vmap:AdBreak timeOffset="<?php echo esc_attr( 0 === $display_time ? 'start' : gmdate( 'H:i:s', $display_time ) ); ?>" breakType="linear">
						<vmap:AdSource allowMultipleAds="false" followRedirects="true">
							<vmap:AdTagURI templateType="vast4">
								<![CDATA[
									<?php 
										echo esc_url_raw( $vast_url ); // The URL used here is for redirect purposes, so it must be raw. This will is used to get the VAST XML.
									?>
								]]>
							</vmap:AdTagURI>
						</vmap:AdSource>
					</vmap:AdBreak>
				<?php endforeach; ?>
			</vmap:VMAP>
		<?php
		$vamp_xml = ob_get_clean();

		return $vamp_xml;
	}

	/**
	 * Get item permissions check.
	 *
	 * Because we are routing to other endpoints,
	 * we don't need to check permissions.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return bool
	 */
	public function get_ad_permissions_check( $request ) {
		return true;
	}
}
