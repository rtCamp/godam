<?php
/**
 * Register REST API endpoints for any Assets file endpoints.
 *
 * @package transcoder
 */

namespace Transcoder\Inc\REST_API;

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
				'route'     => '/' . $this->rest_base . '/ad',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_ad_tag_url' ),
						'permission_callback' => array( $this, 'get_ad_permissions_check' ),
						'args'                => $this->get_collection_params(),
					),
				),
			),
		);
	}

	/**
	 * Check if request  is for /easydam/v1/ad endpoint.
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
		if ( '/easydam/v1/ad' !== $request->get_route() ) {
			return $served;
		}
	
		// Set necessary CORS headers.
		header( 'Access-Control-Allow-Origin: *' ); // Allow all origins.
		header( 'Access-Control-Allow-Methods: GET, POST, OPTIONS' ); // Allow specific methods.
		header( 'Access-Control-Allow-Credentials: true' );
		header( 'Access-Control-Allow-Headers: Content-Type, Authorization, X-WP-Nonce' );
	
		// // Ensure the response is XML.
		header( 'Content-Type: text/xml; charset=utf-8' );
	
		// Output the XML response and terminate the script.
		echo $result->get_data();
		exit;
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
		$endpoint_url = rest_url( $this->namespace . sprintf( '/%s', empty( $this->rest_base ) ? 'ad' : $this->rest_base . 'ad' ) );

		
		ob_start();
		?>
			<VAST version="4.1" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns="http://www.iab.com/VAST">
				<Ad id="20001" sequence="1" conditionalAd="false">
					<InLine>
					<AdSystem version="4.1">EasyDAM</AdSystem>
					<Error><![CDATA[<?php echo esc_url( $endpoint_url ); ?>/error]]></Error>
					<Impression id="Impression-ID"><![CDATA[<?php echo esc_url( $endpoint_url ); ?>/track/impression]]></Impression>
					<AdServingId>a532d16d-4d7f-4440-bd29-2ec0e693fc80</AdServingId>
					<AdTitle><?php echo esc_html( $ad_title ); ?></AdTitle>
					<AdVerifications></AdVerifications>
					<Advertiser>EasyDAM</Advertiser>
					<Creatives>
						<Creative id="5480" sequence="1" adId="2447226">
							<UniversalAdId idRegistry="Ad-ID">8465</UniversalAdId>
							<Linear <?php echo $skippable ? ' skipoffset="' . esc_attr( gmdate( 'H:i:s', $skip_offset ) ) . '"' : ''; ?>>
								<TrackingEvents>
									<Tracking event="start" ><![CDATA[<?php echo esc_url( $endpoint_url ); ?>/tracking/start]]></Tracking>
									<Tracking event="progress" offset="00:00:10"><![CDATA[http://example.com/tracking/progress-10]]></Tracking>
									<Tracking event="firstQuartile"><![CDATA[<?php echo esc_url( $endpoint_url ); ?>/tracking/firstQuartile]]></Tracking>
									<Tracking event="midpoint"><![CDATA[<?php echo esc_url( $endpoint_url ); ?>/tracking/midpoint]]></Tracking>
									<Tracking event="thirdQuartile"><![CDATA[<?php echo esc_url( $endpoint_url ); ?>/tracking/thirdQuartile]]></Tracking>
									<Tracking event="complete"><![CDATA[<?php echo esc_url( $endpoint_url ); ?>/tracking/complete]]></Tracking>
								</TrackingEvents>
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
							<![CDATA[ <?php echo $vast_url; // phpcs:ignore ?> ]]>
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
