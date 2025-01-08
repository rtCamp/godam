/**
 * Write your JS code here for admin.
 */
/* eslint-disable no-console */
console.log( 'Hello from Features Plugin Admin' );
/* eslint-enable no-console */

wp.media.view.MediaFrame = wp.media.view.MediaFrame.extend( {
	render() {
		// Call the parent's `initialize` method
		wp.media.view.MediaFrame.prototype.initialize.apply( this, arguments );

		console.log( 'initialize' );
	},
} );

console.log(
	'wp.media.view.MediaFrame',
	wp.media.view.MediaFrame,
);

// ( function( $ ) {
// 	$( document ).ready( function() {
// 		// Check if wp.media.frame exists
// 		if ( wp && wp.media && wp.media.frame ) {
// 			// Hook into the media frame events
// 			wp.media.frame.on( 'open', function() {
// 				console.log( 'Default WordPress media frame opened.' );
// 			} );

// 			wp.media.frame.on( 'ready', function() {
// 				console.log( 'Default WordPress media frame initialized.' );
// 			} );
// 		} else {
// 			console.log( 'Default WordPress media frame is not available.' );
// 		}
// 	} );
// }( jQuery ) );
