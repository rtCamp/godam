#! /bin/bash
# A modification of Dean Clatworthy's deploy script as found here: https://github.com/deanc/wordpress-plugin-git-svn
# The difference is that this script lives in the plugin's git repo & doesn't require an existing SVN repo.

# main config
export PLUGINSLUG="godam"  #must match with wordpress.org plugin slug
export MAINFILE="godam.php" # this should be the name of your main php file in the wordpress plugin
#SVNUSER="rtcamp" # your svn username

##### YOU CAN STOP EDITING HERE #####
##### Downlaod Common Deploy Settings #####
wget https://raw.github.com/rtCamp/wp-plugin-bootstrap/master/deploy-common.sh

#### Execute Deploy-Common ########
bash deploy-common.sh
rm deploy-common.sh
