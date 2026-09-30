import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { Workspace, FinancialSnapshot } from '../src/models.js';
import { CompanyAction, CompanyDecision, CompanyScenario } from '../src/intelligence/models.js';
import { latestEvaluation, importSnapshot } from '../src/intelligence/service.js';
import { allSignals } from '../src/intelligence/customers.js';
import { scenarioInput, simulateScenario } from '../src/intelligence/scenarios.js';
import { MarketObservation } from '../src/intelligence/market.js';
import { CompanyQuestion, answerCompanyQuestion } from '../src/intelligence/company-questions.js';
await mongoose.connect(process.env.MONGO_URI);
try {
 const w = await Workspace.findById(process.argv[2]);
 const old = w && await latestEvaluation(w._id);
 if (!w?.name.includes('Demo — Synthetic') || old?.snapshot.source.kind !== 'sample') throw new Error('Only the dedicated synthetic demo workspace can be enriched.');
 if (old.snapshot.importKey === 'demo-founder-finish-v1') { console.log('Demo enrichment already loaded.'); } else {
 const now = new Date(), date = d => new Date(now.getTime()+d*86400000).toISOString().slice(0,10), createdBy = w.members[0].userId, workspaceId = w._id;
 const snapshot = structuredClone(old.snapshot); snapshot.importKey = 'demo-founder-finish-v1'; snapshot.observedAt = now.toISOString();
 snapshot.teams.push({id:'growth',name:'Product & Growth'});
 snapshot.employees.push({id:'imani',name:'Imani Brooks (demo)',teamId:'growth',capacityHours:40,allocatedHours:32},{id:'eli',name:'Eli Khan (demo)',teamId:'growth',capacityHours:40,allocatedHours:29});
 snapshot.projects.push({id:'insights',name:'Usage Insights',teamId:'growth',ownerIds:['imani'],dueDate:date(18),completion:55},{id:'activation',name:'Activation Playbook',teamId:'growth',ownerIds:['eli'],dueDate:date(28),completion:40});
 snapshot.features.push({id:'usage-dashboard',name:'Usage Dashboard',projectId:'insights',productId:'workspace'},{id:'activation-guide',name:'Activation Guide',projectId:'activation',productId:'workspace'});
 for(const [i,name] of ['Meadow Design','Juniper Labs','Harbor Studio','Willow Systems','Summit Digital','Pine & Co'].entries()) snapshot.customers.push({id:`growth-${i}`,name:`${name} (demo)`,arrMinor:900000,featureIds:[i%2?'usage-dashboard':'activation-guide'],requestedFeatureIds:['reports'],renewalDate:date(20+i*17),accountManagerId:i%2?'sam':'riley',segment:i<3?'Growth':'SMB',activeUsers:12+i*6,usageWindowDays:30,paymentOverdueDays:i===3?5:0,outstandingAmountMinor:i===3?75000:0,oldestSupportIssueDays:i===3?9:0,openSupportIssues:i===3?2:0});
 Object.assign(snapshot.customers.find(c=>c.id==='bright'),{activeUsers:55});
 Object.assign(snapshot.customers.find(c=>c.id==='acme'),{activeUsers:45,paymentOverdueDays:14});
 await MarketObservation.create({workspaceId,competitorId:w.competitors[1].id,competitorName:w.competitors[1].name,changeType:'feature',description:'SYNTHETIC WALKTHROUGH: fictional TeamPilot announces a usage-reporting feature for growth-stage customers. This fixture shows overlap with the Usage Insights roadmap. The source is a placeholder, not a verified claim.',sourceUrl:'https://example.com/fictional-teampilot-feature',observedAt:now,segments:['Growth'],customerIds:[],createdBy});
 const latest=await importSnapshot(workspaceId,snapshot,new Date());
 const signals=allSignals(latest.analysis);
 for(const [key,title,ownerId,due] of [['customer_health:growth-3','Demo: clear Willow support and billing follow-up','riley',3],['customer_expansion:bright','Demo: schedule a Bright Health growth conversation','sam',9]]) {
 const signal=signals.find(s=>s.key===key); if(!signal)continue;
 await CompanyAction.create({workspaceId,riskKey:key,title,ownerId,ownerName:snapshot.employees.find(e=>e.id===ownerId).name,dueDate:date(due),reason:'Synthetic walkthrough: review the recorded customer evidence with the account owner.',expectedResult:'Record customer context and agree on a measurable next step.',status:'open',baseline:signal.evidence,baselineObservedAt:latest.observedAt,customerIds:signal.customers.map(c=>c.id),createdBy});
 }
 for(const [title,reason,expected,owner] of [['Demo: pilot Usage Insights with three growth accounts','Repeated reporting requests overlap a fictional competitor feature announcement.','Collect feedback from three pilot accounts before expanding scope.','imani'],['Demo: keep the next hiring decision reversible','Engineering pressure requires capacity, while cash runway constrains recurring costs.','Compare a contractor sprint and a full-time hire before committing.','alex']]) await CompanyDecision.create({workspaceId,requestId:crypto.randomUUID(),title,reason,expectedResult:expected,alternatives:'Delay the work; reduce scope; recruit additional capacity.',ownerId:owner,ownerName:snapshot.employees.find(e=>e.id===owner).name,reviewDate:date(14),initialReviewDate:date(14),baselineSource:snapshot.source,baselineObservedAt:latest.observedAt,status:'open',createdBy,createdByName:'Synthetic walkthrough'});
 const financial=await FinancialSnapshot.create({workspaceId,currency:'USD',cash:270000,monthlyRevenue:33500,monthlyExpenses:56000,recordedAt:now});
 for(const fixture of [{name:'Demo: contractor sprint for one-time $12,000',oneTimeCost:12000},{name:'Demo: grow revenue 10% with one new hire',hires:1,monthlyCostPerHire:6000,revenueChangePct:10,hiringStartMonth:2,teamId:'engineering'}]) {const input=scenarioInput.parse({hires:0,monthlyCostPerHire:0,revenueChangePct:0,monthlyExpenseDelta:0,oneTimeCost:0,lostCustomerIds:[],months:12,...fixture});await CompanyScenario.create({workspaceId,name:input.name,assumptions:input,result:simulateScenario(financial,snapshot,input),createdBy});}
 const actions=await CompanyAction.find({workspaceId}),decisions=await CompanyDecision.find({workspaceId}),scenarios=await CompanyScenario.find({workspaceId});
 for(const question of ['What is our runway now?','What should we do for Acme?','Which team has available capacity?','What happens if we hire?']) await CompanyQuestion.create({workspaceId,userId:createdBy,question,...answerCompanyQuestion(question,{latest,financial,actions,decisions,scenarios})});
 console.log(JSON.stringify({workspace:w.name,teams:snapshot.teams.length,employees:snapshot.employees.length,projects:snapshot.projects.length,customers:snapshot.customers.length,actions:actions.length,decisions:decisions.length,scenarios:scenarios.length,signals:signals.length}));
 }
}finally{await mongoose.disconnect();}
