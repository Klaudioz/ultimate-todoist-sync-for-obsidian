import { App} from 'obsidian';
import { UltimateTodoistSyncSettings } from './settings';
import { CacheOperation } from "./cacheOperation";




interface dataviewTaskObject {
    status: string;
    checked: boolean;
    completed: boolean;
    fullyCompleted: boolean;
    text: string;
    visual: string;
    line: number;
    lineCount: number;
    path: string;
    section: string;
    tags: string[];
    outlinks: string[];
    link: string;
    children: any[];
    task: boolean;
    annotated: boolean;
    parent: number;
    blockId: string;
}
  
  
interface todoistTaskObject {
    content: string;
    description?: string;
    project_id?: string;
    section_id?: string;
    parent_id?: string;
    order?: number | null;
    labels?: string[];
    priority?: number | null;
    due_string?: string;
    due_date?: string;
    due_datetime?: string;
    due_lang?: string;
    assignee_id?: string;
}
    

export class TaskParser   {
	app:App;
    settings:UltimateTodoistSyncSettings;
    cacheOperation:CacheOperation;

	constructor(app:App, settings:UltimateTodoistSyncSettings,cacheOperation:CacheOperation) {
		//super(app,settings);
		this.app = app;
        this.settings = settings;
        this.cacheOperation = cacheOperation;
	}


  
  
    //convert line text to a task object
    async convertTextToTodoistTaskObject(lineText:string,filepath:string,lineNumber?:number,fileContent?:string) {
        //console.log(`linetext is:${lineText}`)
    
        let hasParent = false
        let parentId = null
        let parentTaskObject = null
        // 检测 parentID
        let textWithoutIndentation = lineText
        if(this.getTabIndentation(lineText) > 0){
        //console.log(`缩进为 ${this.getTabIndentation(lineText)}`)
        textWithoutIndentation = this.removeTaskIndentation(lineText)
        //console.log(textWithoutIndentation)
        //console.log(`这是子任务`)
        //读取filepath
        //const fileContent = await this.fileOperation.readContentFromFilePath(filepath)
        //遍历 line
        const lines = fileContent.split('\n')
        console.log(lines)
        for (let i = (lineNumber - 1 ); i >= 0; i--) {
            //console.log(`正在check${i}行的缩进`)
            const line = lines[i]
            console.log(line)
            //如果是空行说明没有parent
            if(this.isLineBlank(line)){
                break
            }
            //如果tab数量大于等于当前line,跳过
            if (this.getTabIndentation(line) >= this.getTabIndentation(lineText)) {
                    //console.log(`缩进为 ${this.getTabIndentation(line)}`)
                    continue       
            }
            if((this.getTabIndentation(line) < this.getTabIndentation(lineText))){
                //console.log(`缩进为 ${this.getTabIndentation(line)}`)
                if(this.hasTodoistId(line)){
                    parentId = this.getTodoistIdFromLineText(line)
                    hasParent = true
                    //console.log(`parent id is ${parentId}`)
                    parentTaskObject = this.cacheOperation.loadTaskFromCacheyID(parentId)
                    break
                }
                else{
                    break
                }
            }
        }
    
    
        }
        
        const dueDate = this.getDueDateFromLineText(textWithoutIndentation)
        const labels =  this.getAllTagsFromLineText(textWithoutIndentation)
        //console.log(`labels is ${labels}`)

        //dataview format metadata
        //const projectName = this.getProjectNameFromLineText(textWithoutIndentation) ?? this.settings.defaultProjectName
        //const projectId = await this.cacheOperation.getProjectIdByNameFromCache(projectName)
        //use tag as project name

        let projectId = this.cacheOperation.getDefaultProjectIdForFilepath(filepath as string)
        let projectName = this.cacheOperation.getProjectNameByIdFromCache(projectId)

        if(hasParent){
            projectId = parentTaskObject.projectId
            projectName =this.cacheOperation.getProjectNameByIdFromCache(projectId)
        }
        if(!hasParent){
                    //匹配 tag 和 peoject
            for (const label of labels){
        
                //console.log(label)
                let labelName = label.replace(/#/g, "");
                //console.log(labelName)
                let hasProjectId = this.cacheOperation.getProjectIdByNameFromCache(labelName)
                if(!hasProjectId){
                    continue
                }
                projectName = labelName
                //console.log(`project is ${projectName} ${label}`)
                projectId = hasProjectId
                break
            }
        }


        const content = this.getTaskContentFromLineText(textWithoutIndentation)
        const isCompleted = this.isTaskCheckboxChecked(textWithoutIndentation)
        let description = ""
        const todoist_id = this.getTodoistIdFromLineText(textWithoutIndentation)
        const priority = this.getTaskPriority(textWithoutIndentation)
        if(filepath){
            let url = encodeURI(`obsidian://open?vault=${this.app.vault.getName()}&file=${filepath}`)
            description =`[${filepath}](${url})`;
        }
    
        const todoistTask = {
        projectId: projectId,
        content: content || '',
        parentId: parentId || null,
        dueDate: dueDate || '',
        labels: labels || [],
        description: description,
        isCompleted:isCompleted,
        todoist_id:todoist_id || null,
        hasParent:hasParent,
        priority:priority
        };
        //console.log(`converted task `)
        //console.log(todoistTask)
        return todoistTask;
    }
  
  
  
  
    hasTodoistTag(text:string){
        const regex =/^[\s]*[-] \[[x ]\] [\s\S]*#todoist[\s\S]*$/i; //检测todoist tag
        return(regex.test(text))
    }
  
  
    hasTodoistId(text:string){
        const regex = /\[todoist_id::\s*\d+\]/; //检测todoist_id
        return(regex.test(text))
    }
  
  
    hasDueDate(text:string){
        const regex = /(🗓️|📅|📆|🗓)\d{4}-\d{2}-\d{2}/; //匹配日期🗓️2023-03-07"
        return(regex.test(text))
    }
  
  
    getDueDateFromLineText(text: string) {
        const regex = /(?:🗓️|📅|📆|🗓)(\d{4}-\d{2}-\d{2})/;
        const result = regex.exec(text);
        return result ? result[1] : null;
    }
  
  
    getProjectNameFromLineText(text:string){
        const regex = /\[project::\s*(.*?)\]/;
        const result = regex.exec(text);
        const projectName = result ? result[1] : null; // project 变量将包含 "example"
        return(projectName)
        }
  
  
    getTodoistIdFromLineText(text:string){
        const regex = /\[todoist_id::\s*(.*?)\]/;
        const result = regex.exec(text);
        const todoist_id = result ? result[1] : null; // project 变量将包含 "example"
        return(todoist_id)
    }
  
    getDueDateFromDataview(dataviewTask:object){
        if(!dataviewTask.due){
        return ""
        }
        else{
        const dataviewTaskDue = dataviewTask.due.toString().slice(0, 10)
        return(dataviewTaskDue)
        }

    }
  
  
  
    /*
    //convert line task to dataview task object
    async  getLineTask(filepath,line){
        //const tasks = this.app.plugins.plugins.dataview.api.pages(`"${filepath}"`).file.tasks
        const tasks = await getAPI(this.app).pages(`"${filepath}"`).file.tasks
        const tasksValues = tasks.values
        //console.log(`dataview filepath is ${filepath}`)
        //console.log(`dataview line is ${line}`)
        //console.log(tasksValues)
        const currentLineTask = tasksValues.find(obj => obj.line === line )	
        console.log(currentLineTask)
        return(currentLineTask)
    
    }
    */
  
  
  
    //task text get content
    getTaskContentFromLineText(lineText:string) {
        //检查内容是否修改
        const regexRemovePriority = /\s!!([1-4])\s/
        const regexRemoveTags = /(^|\s)(#[a-zA-Z\d\u4e00-\u9fa5-]+)/g;   //删除tag  const regex = /#[\w\u4e00-\u9fa5-]+/g
        const regexGetContentWithTodoistTag = /(.*)#todoist/;  //提取todoist之前的内容
        const regexRemoveSpace = /\s+$/; //删除末尾的空格
        const regexRemoveDate = /(🗓️|📅|📆|🗓)\d{4}-\d{2}-\d{2}/; //匹配日期🗓️2023-03-07"
        const regexRemoveInlineMetadata = /%%\[\w+::\s*\w+\]%%/;
        const regexRemoveCheckbox =  /^(-|\*)\s+\[(x| )\]\s/;
        const regexRemoveCheckboxWithIndentation = /^([ \t]*)?- \[(x| )\]\s/;
        const TaskContent = lineText.replace(regexRemoveInlineMetadata,"")
                                    .replace(regexRemovePriority," ") //priority 前后必须都有空格，
                                    .replace(regexRemoveTags,"")
                                    .replace(regexRemoveDate,"")
                                    .replace(regexRemoveCheckbox,"")
                                    .replace(regexRemoveCheckboxWithIndentation,"")
                                    .replace(regexRemoveSpace,"")
    
    
        return(TaskContent)
    
    }
  
  
    //get all tags from task text
    getAllTagsFromLineText(lineText:string){
        
        //const regex = /#[\w-]+/g;
        const regex = /#[\w\u4e00-\u9fa5-]+/g  //加上了中文字符
        const tags = lineText.match(regex); // tags 变量将包含 ["#tag1", "#tag2_text", "#tag-3"]
        return(tags)
    }
  
    //get checkbox status
    isTaskCheckboxChecked(text) {
        const regex = /- \[(x|X)\] /;
        return regex.test(text);
    }
  
  
    //task content compare
    taskContentCompare(lineTask:Object,todoistTask:Object) {
        const lineTaskContent = lineTask.content
        //console.log(dataviewTaskContent)
        
        const todoistTaskContent = todoistTask.content
        //console.log(todoistTask.content)

        //content 是否修改
        const contentModified = (lineTaskContent === todoistTaskContent)
        return(contentModified)  
    }
  
  
    //tag compare
    taskTagCompare(lineTask:Object,todoistTask:Object) {
    
    
        const lineTaskTags = lineTask.labels
        //console.log(dataviewTaskTags)
        
        const todoistTaskTags = todoistTask.labels
        //console.log(todoistTaskTags)
    
        //content 是否修改
        const tagsModified  = lineTaskTags.length === todoistTaskTags.length && lineTaskTags.sort().every((val, index) => val === todoistTaskTags.sort()[index]);
        return(tagsModified) 
    }
  
    //task status compare
    taskStatusCompare(lineTask:Object,todoistTask:Object) {
        //status 是否修改
        const statusModified = (lineTask.isCompleted === todoistTask.isCompleted)
        //console.log(lineTask)
        //console.log(todoistTask)
        return(statusModified)
    }
  
  
    //task due date compare
    async  compareTaskDueDate(lineTask: object, todoistTask: object): boolean {
        const lineTaskDue = lineTask.dueDate
        const todoistTaskDue = todoistTask.due ?? "";
        //console.log(dataviewTaskDue)
        //console.log(todoistTaskDue)
        if (lineTaskDue === "" && todoistTaskDue === "") {
        //console.log('没有due date')
        return true;
        }
    
        if ((lineTaskDue || todoistTaskDue) === "") {
        console.log(lineTaskDue);
        console.log(todoistTaskDue)
        //console.log('due date 发生了变化')
        return false;
        }
    
        if (lineTaskDue === todoistTaskDue.date) {
        //console.log('due date 一致')
        return true;
        } else if (lineTaskDue.toString() === "Invalid Date" || todoistTaskDue.toString() === "Invalid Date") {
        console.log('invalid date')
        return false;
        } else {
        //console.log(lineTaskDue);
        //console.log(todoistTaskDue.date)
        return false;
        }
    }
    
  
    //task project id compare
    async  taskProjectCompare(lineTask:Object,todoistTask:Object) {
        //project 是否修改
        //console.log(dataviewTaskProjectId)
        //console.log(todoistTask.projectId)
        return(lineTask.projectId === todoistTask.projectId)
    }
  
  
    //判断任务是否缩进
    isIndentedTask(text:string) {
        const regex = /^(\s{2,}|\t)(-|\*)\s+\[(x| )\]/;
        return regex.test(text);
    }
  
  
    //判断制表符的数量
    //console.log(getTabIndentation("\t\t- [x] This is a task with two tabs")); // 2
    //console.log(getTabIndentation("  - [x] This is a task without tabs")); // 0
    getTabIndentation(text) {
        const regex = /^(\t+)/;
        const match = text.match(regex);
        return match ? match[1].length : 0;
    }
    //	Task priority from 1 (normal) to 4 (urgent).
    getTaskPriority(text:string): number{
        const regex = /\s!!([1-4])\s/
        const match = text.match(regex)
        return match ? Number(match[1]) : 1;
    }
  
  
  
    //remove task indentation
    removeTaskIndentation(text) {
        const regex = /^([ \t]*)?- \[(x| )\] /;
        return text.replace(regex, "- [$2] ");
    }
  
  
    //判断line是不是空行
    isLineBlank(line) {
        const pattern = /^\s*$/; // 匹配由零个或多个空白字符组成的行
        return pattern.test(line);
    }
  
  
  //在linetext中插入日期
    insertDueDateBeforeTodoist(text, dueDate) {
    return text.replace(/#todoist/, `📅${dueDate} #todoist`);
  }

    //extra date from obsidian event
    // 使用示例
    //const str = "2023-03-27T15:59:59.000000Z";
    //const dateStr = extractDate(str);
    //console.log(dateStr); // 输出 2023-03-27
    extractDateFromTodoistEvent(str:string) {
        try {
          if(str === null){
            return null
          }
          const regex = /(\d{4})-(\d{2})-(\d{2})/;
          const matches = str.match(regex);
          if (!matches) throw new Error('No date found in string.');
          const dateStr = `${matches[1]}-${matches[2]}-${matches[3]}`;
          return dateStr;
        } catch (error) {
          console.error(`Error extracting date from string '${str}': ${error}`);
          return null;
        }
      }
     
}
