
/* global moment */

const MediaDateRangeFilter = wp.media.View;

export default MediaDateRangeFilter.extend( {

	tagName: 'input',
	id: 'media-date-range-filter',

	events: {
		'apply.daterangepicker': 'updateFilter',
		'show.daterangepicker': 'updatePickerPosition',
	},

	/**
	 * update the top position of picker so it does not look out of place.
	 */
	updatePickerPosition() {
		const daterangepickerElement = this.$el.data( 'daterangepicker' ).container;
		const currentTop = parseInt( daterangepickerElement.css( 'top' ), 10 );
		const newTop = currentTop - 30;
		daterangepickerElement.css( 'top', newTop + 'px' );
	},

	updateFilter() {
		const dateRangePicker = this.$el.data( 'daterangepicker' );

		if ( ! dateRangePicker ) {
			return;
		}

		const startDate = dateRangePicker.startDate.format( 'YYYY-MM-DD' );
		const endDate = dateRangePicker.endDate.format( 'YYYY-MM-DD' );

		/**
		 * Create a date query based on the selected date range.
		 */
		const dateQuery = [];

		if ( startDate ) {
			dateQuery.push( { after: startDate } );
		}
		if ( endDate ) {
			dateQuery.push( { before: endDate } );
		}

		this.model.set( {
			date_query: dateQuery.length > 0 ? { relation: 'AND', ...dateQuery } : undefined,
		} );
	},

	render() {
		// Call the parent render method
		wp.media.View.prototype.render.apply( this, arguments );

		this.$el.daterangepicker(
			{
				locale: {
					cancelLabel: 'Clear',
				},
				ranges: {
					Today: [ moment(), moment() ],
					Yesterday: [ moment().subtract( 1, 'days' ), moment().subtract( 1, 'days' ) ],
					'Last 7 Days': [ moment().subtract( 6, 'days' ), moment() ],
					'Last 30 Days': [ moment().subtract( 29, 'days' ), moment() ],
					'This Month': [ moment().startOf( 'month' ), moment().endOf( 'month' ) ],
					'Last Month': [ moment().subtract( 1, 'month' ).startOf( 'month' ), moment().subtract( 1, 'month' ).endOf( 'month' ) ],
				},
				alwaysShowCalendars: true,
			},
		);

		return this;
	},
} );
