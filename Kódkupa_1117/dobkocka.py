N = int(input())
A_wins = int(0)
B_wins = int(0)
draw = int(0)
list = []
for i in range(N):
    temp = input()
    list.append(temp.split(" "))
    temp = ""
for i in range(len(list)):

    if list[i][0] < list[i][1]:
        eredmeny1 = list[i][0]+list[i][1]
    else:
        eredmeny1 = list[i][1]+list[i][0]
    if list[i][2] < list[i][3]:
        eredmeny2 = list[i][2]+list[i][3]
    else:
        eredmeny2 = list[i][3]+list[i][2]
    

    if list[i][0] == list[i][1] and list[i][2] == list[i][3]:
        if max(list[i][0],list[i][1]) > max(list[i][2],list[i][3]):
            A_wins +=1
        elif max(list[i][0],list[i][1]) < max(list[i][2],list[i][3]):
            B_wins +=1
        else:
            draw +=1
    else:
        if list[i][0] == list[i][1]:
            A_wins +=1
        elif list[i][2] == list[i][3]:
            B_wins +=1
        elif int(eredmeny1) > int(eredmeny2):
            A_wins +=1
        elif int(eredmeny2) > int(eredmeny1):
            B_wins +=1
        elif int(eredmeny1) == int(eredmeny2):
            draw +=1
        
print(A_wins,B_wins,draw)