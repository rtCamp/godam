
/* global MediaLibraryTaxonomyFilterData, _ */

let MediaLibraryTaxonomyFilter = wp?.media?.view?.AttachmentFilters;

MediaLibraryTaxonomyFilter = MediaLibraryTaxonomyFilter?.extend( {

	id: 'media-folder-filter',

	events: {
		change: 'change',
	},

	change( event ) {
		if ( event.detail ) {
			this.filters[ event.detail.term_id ] = {
				text: event.detail.name,
				props: {
					'media-folder': event.detail.term_id,
				},
			};
		} else {
			const props = this.filters[ this.el.value ]?.props;
			if ( props ) {
				this.model.set( props );
			}
		}
	},

	createFilters() {
		const filters = {};
		_.each( MediaLibraryTaxonomyFilterData.terms || {}, function( value ) {
			filters[ value.term_id ] = {
				text: value.name,
				props: {
					'media-folder': value.term_id,
				},
			};
		} );

		filters.uncategorized = {
			text: 'Uncategorized',
			props: {
				'media-folder': 0,
			},
			priority: 5,
		};

		filters.all = {
			text: 'All collections',
			props: {
				'media-folder': -1,
			},
			priority: 10,
		};
		this.filters = filters;
	},
} );

export default MediaLibraryTaxonomyFilter;
