// node matchExtracter.js --source=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results  --dataDir=WorldCup

let minimist = require('minimist');
let axios = require('axios');
let jsdom = require('jsdom');
let fs = require('fs');
let excel = require('excel4node');
let path = require('path');
let pdf = require('pdf-lib');


let args = minimist(process.argv);

let htmlPromise = axios.get(args.source);
htmlPromise.then(function(response) {
    let html = response.data;

    let dom = new jsdom.JSDOM(html);
    let document = dom.window.document;

    matchesDivs = document.querySelectorAll("div.match-score-block");
    let matches = [];
    for (let i = 0; i < matchesDivs.length; i++) {
        matchDiv = matchesDivs[i];
        match = {
            t1: "",
            t2: "",
            t1s: "",
            t2s: "",
            result: ""
        }

        teamName = matchDiv.querySelectorAll("div.name-detail > p.name");
        match.t1 = teamName[0].textContent;
        match.t2 = teamName[1].textContent;

        teamScore = matchDiv.querySelectorAll("div.score-detail > span.score");

        if (teamScore.length == 2) {
            match.t1s = teamScore[0].textContent;
            match.t2s = teamScore[1].textContent;
        } else if (teamScore.length == 1) {
            match.t1s = teamScore[0].textContent;
            match.t2s = "";
        } else {
            match.t1s = "";
            match.t2s = "";
        }

        resultSpan = matchDiv.querySelector("div.status-text > span");
        match.result = resultSpan.textContent;
        matches.push(match);
    }
    let matchesJson = JSON.stringify(matches);
    fs.writeFileSync("match.json", matchesJson, "utf-8");

    let teams = [];
    for (let i = 0; i < matches.length; i++) {
        addTeamName(teams, matches[i].t1, matches[i].t2);
    }

    for (let i = 0; i < matches.length; i++) {
        addMatches(teams, matches[i]);
    }
    let teamJson = JSON.stringify(teams);
    fs.writeFileSync("teams.json", teamJson, "utf-8");

    makeExcel(teams);
    makeFolder(teams, args.dataDir);
})

function makePdf(folderName, homeTeam, match) {
    let matchFileName = path.join(folderName, match.vs);
    let templateBytes = fs.readFileSync("Template.pdf");
    let pdfPromise = pdf.PDFDocument.load(templateBytes);
    pdfPromise.then(function(pdfdoc) {
        let page = pdfdoc.getPage(0);

        page.drawText(homeTeam, {
            x: 320,
            y: 357,
            size: 24
        });

        page.drawText(match.vs, {
            x: 100,
            y: 230,
            size: 20
        });

        page.drawText(match.selfScore, {
            x: 273,
            y: 230,
            size: 24
        });

        page.drawText(match.oppScore, {
            x: 426,
            y: 230,
            size: 24
        });

        page.drawText(match.result, {
            x: 180,
            y: 145,
            size: 20
        });


        let changedBytesPromise = pdfdoc.save();
        changedBytesPromise.then(function(changedBytes) {
            if (fs.existsSync(matchFileName + ".pdf") == true) {
                fs.writeFileSync(matchFileName + "1.pdf", changedBytes);
            } else {
                fs.writeFileSync(matchFileName + ".pdf", changedBytes);
            }
        })
    })
}

function makeFolder(teams, dataDir) {
    if (fs.existsSync(dataDir) == true) {
        fs.rmdirSync(dataDir, { recursive: true });
    }
    fs.mkdirSync(dataDir);

    for (let i = 0; i < teams.length; i++) {
        let teamFolderName = path.join(dataDir, teams[i].teamName);
        fs.mkdirSync(teamFolderName);

        for (let j = 0; j < teams[i].Matches.length; j++) {
            let match = teams[i].Matches[j];

            makePdf(teamFolderName, teams[i].teamName, match);
        }
    }

}

function makeExcel(teams) {
    let wb = new excel.Workbook();

    for (let i = 0; i < teams.length; i++) {
        let sheet = wb.addWorksheet(teams[i].teamName);
        sheet.cell(1, 1).string("Vs");
        sheet.cell(1, 2).string("Self Score");
        sheet.cell(1, 3).string("Opp Score");
        sheet.cell(1, 4).string("Result");

        for (let j = 0; j < teams[i].Matches.length; j++) {
            sheet.cell(2 + j, 1).string(teams[i].Matches[j].vs);
            sheet.cell(2 + j, 2).string(teams[i].Matches[j].selfScore);
            sheet.cell(2 + j, 3).string(teams[i].Matches[j].oppScore);
            sheet.cell(2 + j, 4).string(teams[i].Matches[j].result);
        }
    }
    wb.write("WorldCup.xlsx");
}

function addMatches(teams, match) {
    let t1idx = -1;
    for (let i = 0; i < teams.length; i++) {
        if (teams[i].teamName == match.t1) {
            t1idx = i;
            break;
        }
    }
    let team1 = teams[t1idx];
    team1.Matches.push({
        vs: match.t2,
        selfScore: match.t1s,
        oppScore: match.t2s,
        result: match.result
    });

    let t2idx = -1;
    for (let i = 0; i < teams.length; i++) {
        if (teams[i].teamName == match.t2) {
            t2idx = i;
            break;
        }
    }
    let team2 = teams[t2idx];
    team2.Matches.push({
        vs: match.t1,
        selfScore: match.t2s,
        oppScore: match.t1s,
        result: match.result
    });
}

function addTeamName(teams, team1, team2) {
    let t1idx = -1;
    for (let i = 0; i < teams.length; i++) {
        if (teams[i].teamName == team1) {
            t1idx = i;
            break;
        }
    }
    if (t1idx == -1) {
        let matches = {
            teamName: "",
            Matches: []
        }
        matches.teamName = team1;
        teams.push(matches);
    }

    let t2idx = -1;
    for (let i = 0; i < teams.length; i++) {
        if (teams[i].teamName == team2) {
            t2idx = i;
            break;
        }
    }
    if (t2idx == -1) {
        let matches = {
            teamName: "",
            Matches: []
        }
        matches.teamName = team2;
        teams.push(matches);
    }
}