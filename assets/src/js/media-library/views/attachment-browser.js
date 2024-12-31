
/**
 * Internal dependencies
 */
import MediaLibraryTaxonomyFilter from './filters/media-library-taxonomy-filter';
import MediaDateRangeFilter from './filters/media-date-range-filter';

const AttachmentsBrowser = wp.media.view.AttachmentsBrowser;

/**
 * Attachment Browser with custom filters.
 */
export default AttachmentsBrowser.extend( {

	createToolbar() {
		// Make sure to load the original toolbar
		AttachmentsBrowser.prototype.createToolbar.call( this );

		this.toolbar.set(
			'MediaLibraryTaxonomyFilter',
			new MediaLibraryTaxonomyFilter( {
				controller: this.controller,
				model: this.collection.props,
				priority: -75,
			} ).render(),
		);

		this.toolbar.set(
			'MediaDateRangeFilter',
			new MediaDateRangeFilter( {
				controller: this.controller,
				model: this.collection.props,
				priority: -80,
			} ).render(),
		);
	},

} );
