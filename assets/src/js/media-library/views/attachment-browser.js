
/**
 * Internal dependencies
 */
import MediaLibraryTaxonomyFilter from './filters/media-library-taxonomy-filter';
import MediaDateRangeFilter from './filters/media-date-range-filter';
import MediaUploadToS3 from './filters/media-upload-to-s3';

const AttachmentsBrowser = wp?.media?.view?.AttachmentsBrowser;

/**
 * Attachment Browser with Custom Filters
 *
 * Note: Exporting the `extend` object directly works as expected.
 * However, reassigning it to a variable before exporting causes an infinite loop.
 */
export default AttachmentsBrowser?.extend( {

	createToolbar() {
		// Make sure to load the original toolbar
		AttachmentsBrowser.prototype.createToolbar.call( this );

		if ( MediaLibraryTaxonomyFilter ) {
			this.toolbar.set(
				'MediaLibraryTaxonomyFilter',
				new MediaLibraryTaxonomyFilter( {
					controller: this.controller,
					model: this.collection.props,
					priority: -75,
				} ).render(),
			);
		}

		if ( MediaDateRangeFilter ) {
			this.toolbar.set(
				'MediaDateRangeFilter',
				new MediaDateRangeFilter( {
					controller: this.controller,
					model: this.collection.props,
					priority: -80,
				} ).render(),
			);
		}

		if ( MediaUploadToS3 ) {
			this.toolbar.set(
				'MediaUploadToS3',
				new MediaUploadToS3( {
					controller: this.controller,
					model: this.collection.props,
					priority: -75,
				} ).render(),
			);
		}
	},
} );
