var sortBy = require('sort-array')
var restify = require('restify')
var Board = require('./Board')
var Sprint = require('./Sprint')

var sprintHistory = [];
var originalSort = [];

var server = restify.createServer()
server.use(restify.fullResponse())
server.use(restify.bodyParser({ mapParams: true }))

server.use(
  function crossOrigin(req,res,next){
    res.header("Access-Control-Allow-Origin", "*")
    res.header("Access-Control-Allow-Headers", "X-Requested-With")
    return next()
  }
)

server.get("/jiradata/sprinthistory", function(req, res, next) {
  var boardId = 159;
  sprintHistory = [];
  res.setHeader('Access-Control-Allow-Origin', '*');

  var board = new Board(boardId)
  board.getSprints(handleSprints, function() {
    res.json(sprintHistory);
  })

  next();
});

var port = 3001
server.listen(port, function (err) {
    if (err) {
        console.error(err)
        return 1
    } else {
        return 0
    }
})

function extractActiveSprint(sprints) {
	var arrayLength = sprints.maxResults;
	var values = sprints.values;

	for (var i = 0; i < arrayLength; i++) {
		if(values[i].state=='active') {
			return values[i].id;
		}
	}
}

function extractPulledStoryPoints(sprint) {
	var addedDuringSprint = sprint.contents.issueKeysAddedDuringSprint;
	var issues = sprint.contents.completedIssues.concat(sprint.contents.incompletedIssues);
	
	var pulledStorypoints = 0;

	var keys = Object.keys(addedDuringSprint);
    for(var i=0; i<keys.length; i++) {
		for(var j=0; j<issues.length; j++) {
			if(issues[j].key == keys[i]) {
				var value = issues[j].estimateStatistic.statFieldValue.value;
				
				if(value) {
					pulledStorypoints += value;	
				}
			}
		}
    }
	return pulledStorypoints;
}

function extractTypeDistribution(sprint) {
	
	var typeSums = new Array();
	typeSums["bugs"] = 0;
	typeSums["tasks"] = 0;
	typeSums["improvements"] = 0;
	typeSums["stories"] = 0;
	typeSums["research"] = 0;
	
	var issues = sprint.contents.completedIssues.concat(sprint.contents.incompletedIssues);
	for(var i=0; i<issues.length; i++) {
		
		var storyType = issues[i].typeName;
		var value = issues[i].estimateStatistic.statFieldValue.value;
		
		switch(storyType) {
			case "Bug":
				typeSums["bugs"] += value;
				break;
			case "Story":
				typeSums["stories"] += value;
				break;
			case "Task":
				typeSums["tasks"] += value;
				break;
			case "Improvement":
				typeSums["improvements"] += value;
				break;
			case "Research":
				typeSums["research"] += value;
				break;
		}
	}
	
	return typeSums;
}

function extractSprintData(sprint) {
	var pulledStoryPoint = extractPulledStoryPoints(sprint);
	var typeSums = extractTypeDistribution(sprint);
	var SprintData = {
		id: sprint.sprint.id,
		sprintName: sprint.sprint.name,
		storyPoints: {
			promised: sprint.contents.allIssuesEstimateSum.text - pulledStoryPoint,
			leftOvers: sprint.contents.incompletedIssuesEstimateSum.text,
			pulled: pulledStoryPoint
		},
		typeDistribution: [
				{
					title: "Bug",
					storyPoints : typeSums["bugs"]
				},
				{
					title: "Task",
					storyPoints : typeSums["tasks"]
				},
				{
					title: "Story",
					storyPoints : typeSums["stories"]
				},
				{
					title: "Improvment",
					storyPoints : typeSums["improvements"]
				},
				{
					title: "Research",
					storyPoints : typeSums["research"]
				}
			]
	}
	return SprintData;
}

function handleSprints(boardId, result, ready) {
  for(var i = 0; i < result.length; i++) {
    originalSort.push(result[i]);
    var sprint = new Sprint(boardId, result[i])
    sprint.getSprint(handleSprint, ready, result.length)
  }
}

function handleSprint(sprint, expectedSprintCount, ready) {
  sprintHistory.push(extractSprintData(sprint))
  if(sprintHistory.length == expectedSprintCount) {
    sortBy(sprintHistory, "id", { id: originalSort })
    ready()
  }
}
