/* global jQuery */

jQuery( document ).ready( function( $ ) {
	const rtMedia = window.rtgodamRetranscode?.ids;
	const rtTotal = rtMedia.length;
	let rtCount = 1;
	let rtSuccesses = 0;
	let rtErrors = 0;
	let rtFailedlist = '';
	let rtResultText = '';
	const rtTimeStart = new Date().getTime();
	let rtTimeEnd = 0;
	let rtTotaltime = 0;
	let rtContinue = true;

	// Create the progress bar
	$( '#retranscodemedia-bar' ).progressbar();
	$( '#retranscodemedia-bar-percent' ).html( '0%' );

	// Stop button
	$( '#retranscodemedia-stop' ).click( function() {
		rtContinue = false;
		$( '#retranscodemedia-stop' ).val( window.rtgodamRetranscode?.stoppingText );
	} );

	// Clear out the empty list element that's there for HTML validation purposes
	$( '#retranscodemedia-debuglist li' ).remove();

	// Called after each resize. Updates debug information and the progress bar.
	function RetranscodeMediaUpdateStatus( id, success, response ) {
		$( '#retranscodemedia-bar' ).progressbar( 'value', ( rtCount / rtTotal ) * 100 );
		$( '#retranscodemedia-bar-percent' ).html( Math.round( ( ( rtCount / rtTotal ) * 1000 ) / 10 ) + '%' );
		rtCount = rtCount + 1;

		if ( success ) {
			rtSuccesses = rtSuccesses + 1;
			$( '#retranscodemedia-debug-successcount' ).html( rtSuccesses );
			$( '#retranscodemedia-debuglist' ).append( '<li>' + response.success + '</li>' );
		} else {
			rtErrors = rtErrors + 1;
			rtFailedlist = rtFailedlist + ',' + id;
			$( '#retranscodemedia-debug-failurecount' ).html( rtErrors );
			$( '#retranscodemedia-debuglist' ).append( '<li>' + response.error + '</li>' );
		}
	}

	// Called when all images have been processed. Shows the results and cleans up.
	function RetranscodeMediaFinishUp() {
		rtTimeEnd = new Date().getTime();
		rtTotaltime = Math.round( ( rtTimeEnd - rtTimeStart ) / 1000 );

		$( '#retranscodemedia-stop' ).hide();

		if ( rtErrors > 0 ) {
			rtResultText = `All done! ${ rtSuccesses } media file(s) were successfully sent for transcoding in ${ rtTotaltime } seconds and there were ${ rtErrors } failure(s). To try transcoding the failed media again, <a href="${ window.rtgodamRetranscode?.adminUrl }&ids=${ rtFailedlist }">click here</a>. ${ window.rtgodamRetranscode?.textGoback }`;
		} else {
			rtResultText = `All done! ${ rtSuccesses } media file(s) were successfully sent for transcoding in ${ rtTotaltime } seconds and there were 0 failures. ${ window.rtgodamRetranscode?.textGoback }`;
		}
		$( '#message' ).html( '<p><strong>' + rtResultText + '</strong></p>' );
		$( '#message' ).show();
	}
	// Regenerate a specified image via AJAX
	function RetranscodeMedia( id ) {
		$.ajax( {
			type: 'POST',
			url: window.ajaxurl,
			data: { action: 'retranscodemedia', id },
			success( response ) {
				if ( response !== Object( response ) || ( typeof response.success === 'undefined' && typeof response.error === 'undefined' ) ) {
					response = new Object;
					response.success = false;
					response.error = `The resize request was abnormally terminated (ID ${ id }). This is likely due to the media exceeding available memory or some other type of fatal error.`;
				}

				if ( response.success ) {
					RetranscodeMediaUpdateStatus( id, true, response );
				} else {
					RetranscodeMediaUpdateStatus( id, false, response );
				}

				if ( rtMedia.length && rtContinue ) {
					RetranscodeMedia( rtMedia.shift() );
				} else {
					RetranscodeMediaFinishUp();
				}
			},
			error( response ) {
				RetranscodeMediaUpdateStatus( id, false, response );

				if ( rtMedia.length && rtContinue ) {
					RetranscodeMedia( rtMedia.shift() );
				} else {
					RetranscodeMediaFinishUp();
				}
			},
		} );
	}

	RetranscodeMedia( rtMedia.shift() );
} );

