/* global MediaLibraryTagFilterData */

let MediaTagFilter = wp?.media?.view?.AttachmentFilters;

MediaTagFilter = MediaTagFilter?.extend( {
	createFilters() {
		const filters = {};
		filters.all = {
			text: 'All Tags',
			props: { media_tag: '' },
		};

		MediaLibraryTagFilterData.terms.forEach( ( term ) => {
			filters[ term.slug ] = {
				text: term.name,
				props: { media_tag: term.slug },
			};
		} );

		this.filters = filters;
	},
} );

export default MediaTagFilter;
