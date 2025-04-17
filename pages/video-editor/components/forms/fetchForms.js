import { useGetGravityFormsQuery } from '../../redux/api/gravity-forms';
import { useGetWPFormsQuery } from '../../redux/api/wpforms';
import { useGetCF7FormsQuery } from '../../redux/api/cf7-forms';

export const useFetchForms = () => {
	const { data: cf7Forms, isLoading: isLoadingCF7 } = useGetCF7FormsQuery();
	const { data: gravityForms, isLoading: isLoadingGravity } = useGetGravityFormsQuery();
	const { data: wpForms, isLoading: isLoadingWPForms } = useGetWPFormsQuery();

	const isLoading = isLoadingCF7 || isLoadingGravity || isLoadingWPForms;

	return {
		cf7Forms,
		gravityForms,
		wpForms,
		isLoading,
	};
};
