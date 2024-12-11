/**
 * Transcoder admin page.
 *
 * @package transcoder
 */

/* global ajaxurl, rt_transcoder_script */

( function ( $ ) {
	$( document ).ready(
		function() {

			$( document ).on(
				'click',
				'#api-key-submit',
				function( e ) {
					var apikey = document.getElementById( 'new-api-key' ).value;

					if ( ! apikey ) {

						$( '#api-key-error' ).remove();

						var error_div = $(
							'<div/>',
							{
								id: 'api-key-error',
								class: 'error'
							}
						);

						$( 'h1:first' ).after( error_div.html( $( '<p/>' ).text( rt_transcoder_script.error_empty_key ) ) );

						e.preventDefault();
					}
				}
			);

			$( document ).on(
				'click',
				'#disable-transcoding',
				function( e ) {

					e.preventDefault();

					if ( confirm( rt_transcoder_script.disable_encoding ) ) {

						var data = {
							action: 'rt_disable_transcoding',
							rt_transcoder_nonce: rt_transcoder_script.security_nonce_for_disabling_encoding
						};

						if ( $( this ).next( 'img' ).length === 0 ) {
							$( this ).after( $( '<img />' ).attr( 'src', rt_transcoder_script.loader_image ).addClass( 'rtt-loader' ) );
						}

						// Since 2.8 ajaxurl is always defined in the admin header and points to admin-ajax.php.
						$.post(
							ajaxurl,
							data,
							function( response ) {
								if ( response ) {
									if ( $( '#rtt-settings_updated' ).length > 0 ) {
										$( '#rtt-settings_updated p' ).text( response );
										$( '#rtt-settings_updated' ).show();
									}

									// $( '#rtmedia-transcoding-usage' ).hide();
									$( '#disable-transcoding' ).next( 'img' ).remove();
									$( '#disable-transcoding' ).hide();
									$( '#enable-transcoding' ).css( 'display', 'inline' );
								}
							}
						);
					}
				}
			);

			$( document ).on(
				'click',
				'#enable-transcoding',
				function( e ) {

					e.preventDefault();

					if ( confirm( rt_transcoder_script.enable_encoding ) ) {

						var data = {
							action: 'rt_enable_transcoding',
							rt_transcoder_nonce: rt_transcoder_script.security_nonce_for_enabling_encoding
						};

						if ( $( this ).next( 'img' ).length === 0 ) {
							$( this ).after( $( '<img />' ).attr( 'src', rt_transcoder_script.loader_image ).addClass( 'rtt-loader' ) );
						}

						$.post(
							ajaxurl,
							data,
							function( response ) {
								if ( response ) {
									if ( $( '#rtt-settings_updated' ).length > 0 ) {
										$( '#rtt-settings_updated p' ).text( response );
										$( '#rtt-settings_updated' ).show();
									}

									$( '#enable-transcoding' ).next( 'img' ).remove();
									$( '#enable-transcoding' ).hide();
									$( '#disable-transcoding' ).css( 'display', 'inline' );
								} else {
									$( '#settings-error-transcoding-disabled' ).remove();
								}
							}
						);
					}
				}
			);
		}
	);

} )( jQuery );
