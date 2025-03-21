jQuery( document ).ready( function( $ ) {
	let i;
	const rt_media = window.rtgodam_retranscode?.ids;
	const rt_total = rt_media.length;
	let rt_count = 1;
	const rt_percent = 0;
	let rt_successes = 0;
	let rt_errors = 0;
	let rt_failedlist = '';
	let rt_resulttext = '';
	const rt_timestart = new Date().getTime();
	let rt_timeend = 0;
	let rt_totaltime = 0;
	let rt_continue = true;

	// Create the progress bar
	$( '#retranscodemedia-bar' ).progressbar();
	$( '#retranscodemedia-bar-percent' ).html( '0%' );

	// Stop button
	$( '#retranscodemedia-stop' ).click( function() {
		rt_continue = false;
		$( '#retranscodemedia-stop' ).val( window.rtgodam_retranscode?.stoppingText );
	} );

	// Clear out the empty list element that's there for HTML validation purposes
	$( '#retranscodemedia-debuglist li' ).remove();

	// Called after each resize. Updates debug information and the progress bar.
	function RetranscodeMediaUpdateStatus( id, success, response ) {
		$( '#retranscodemedia-bar' ).progressbar( 'value', ( rt_count / rt_total ) * 100 );
		$( '#retranscodemedia-bar-percent' ).html( Math.round( ( rt_count / rt_total ) * 1000 ) / 10 + '%' );
		rt_count = rt_count + 1;

		if ( success ) {
			rt_successes = rt_successes + 1;
			$( '#retranscodemedia-debug-successcount' ).html( rt_successes );
			$( '#retranscodemedia-debuglist' ).append( '<li>' + response.success + '</li>' );
		} else {
			rt_errors = rt_errors + 1;
			rt_failedlist = rt_failedlist + ',' + id;
			$( '#retranscodemedia-debug-failurecount' ).html( rt_errors );
			$( '#retranscodemedia-debuglist' ).append( '<li>' + response.error + '</li>' );
		}
	}

	// Called when all images have been processed. Shows the results and cleans up.
	function RetranscodeMediaFinishUp() {
		rt_timeend = new Date().getTime();
		rt_totaltime = Math.round( ( rt_timeend - rt_timestart ) / 1000 );

		$( '#retranscodemedia-stop' ).hide();

		if ( rt_errors > 0 ) {
			rt_resulttext = `All done! ${ rt_successes } media file(s) were successfully sent for transcoding in ${ rt_totaltime } seconds and there were ${ rt_errors } failure(s). To try transcoding the failed media again, <a href="${ window.rtgodam_retranscode?.admin_url }&ids=${ rt_failedlist }">click here</a>. ${ window.rtgodam_retranscode?.text_goback }`;
		} else {
			rt_resulttext = `All done! ${ rt_successes } media file(s) were successfully sent for transcoding in ${ rt_totaltime } seconds and there were 0 failures. ${ window.rtgodam_retranscode?.text_goback }`;
		}
		$( '#message' ).html( '<p><strong>' + rt_resulttext + '</strong></p>' );
		$( '#message' ).show();

		$( '#retranscode-goback' ).on( 'click', function() {
			window.rtgodam_retranscode;
		} );
	}
	// Regenerate a specified image via AJAX
	function RetranscodeMedia( id ) {
		
		$.ajax( {
			type: 'POST',
			url: ajaxurl,
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

				if ( rt_media.length && rt_continue ) {
					RetranscodeMedia( rt_media.shift() );
				} else {
					RetranscodeMediaFinishUp();
				}
			},
			error( response ) {
				RetranscodeMediaUpdateStatus( id, false, response );

				if ( rt_media.length && rt_continue ) {
					RetranscodeMedia( rt_media.shift() );
				} else {
					RetranscodeMediaFinishUp();
				}
			},
		} );
	}

	RetranscodeMedia( rt_media.shift() );
} );

