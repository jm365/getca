# 安装
> npm i getca -g

# 使用方式(在仓库文件夹内)
> getca [args]

example：
> getca 'rType=git'

# 参数说明

以location.search的格式传参,除rType外所有参数都为非必填   
@param {string} startTime 开始时间 2018-01-01T18:03:03   
@param {string} endTime 结束时间   
@param {string} author 修订的作者   
@param {string} rType 仓库类型 git || svn 默认为svn   
@param {string} tdNumber 提交记录msg中备注的TD号   
@param {string} path 指定需要统计的路径   
> getca 'startTime=2018-01-01T18:03:03&endTime=2018-02-01T18:03:03&author=yxw&rType=git&tdNumber=84566&path=ext/js'
 